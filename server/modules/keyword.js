// keyword.js — Keyword intelligence via DataForSEO
const axios = require('axios');
const { mockKeywordData } = require('./mock');

const isMock = () => process.env.MOCK_MODE === 'true';

async function getKeywordData(keyword, location = 'Australia') {
  if (isMock()) {
    await delay(800); // simulate API latency
    return mockKeywordData(keyword);
  }

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  const credentials = Buffer.from(`${login}:${password}`).toString('base64');

  // Location codes: 2036 = Australia, 2840 = United States
  const locationCode = location === 'Australia' ? 2036 : 2840;

  try {
    // 1. Search volume + difficulty
    const kdResponse = await axios.post(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      [{ keywords: [keyword], location_code: locationCode, language_code: 'en' }],
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' } }
    );

    const kd = kdResponse.data.tasks[0].result[0];

    // 2. SERP results with DA
    const serpResponse = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [{ keyword, location_code: locationCode, language_code: 'en', depth: 10 }],
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' } }
    );

    const serpItems = serpResponse.data.tasks[0].result[0].items
      .filter(i => i.type === 'organic')
      .slice(0, 10)
      .map(i => ({
        url: i.url,
        domain: i.domain,
        da: i.rank_absolute || 50,
        title: i.title,
        word_count: i.word_count || 1500,
        published: i.timestamp ? i.timestamp.split('T')[0] : '2023-01-01'
      }));

    // 3. Related keywords
    const relatedResponse = await axios.post(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live',
      [{ keywords: [keyword], location_code: locationCode, language_code: 'en', limit: 10 }],
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' } }
    );

    const related = (relatedResponse.data.tasks[0].result || []).slice(0, 5).map(r => ({
      keyword: r.keyword,
      volume: r.search_volume || 0,
      difficulty: r.keyword_difficulty || 0
    }));

    // 4. PAA questions from SERP
    const paaItems = serpResponse.data.tasks[0].result[0].items
      .filter(i => i.type === 'people_also_ask')
      .flatMap(i => i.items || [])
      .slice(0, 5)
      .map(i => i.title || i.question);

    return {
      keyword,
      volume: kd.search_volume || 0,
      difficulty: kd.keyword_difficulty || 0,
      cpc: kd.cpc || 0,
      trend: getTrend(kd.monthly_searches || []),
      intent: classifyIntent(keyword, serpItems),
      serp_features: extractSerpFeatures(serpResponse.data.tasks[0].result[0].items),
      related_keywords: related,
      top_10: serpItems,
      paa_questions: paaItems
    };

  } catch (err) {
    console.error('DataForSEO error:', err.message);
    throw new Error('Keyword data fetch failed. Check your DataForSEO credentials.');
  }
}

function getTrend(monthlySearches) {
  if (!monthlySearches || monthlySearches.length < 3) return 'stable';
  const recent = monthlySearches.slice(-3).map(m => m.search_volume);
  const older = monthlySearches.slice(-6, -3).map(m => m.search_volume);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  if (recentAvg > olderAvg * 1.1) return 'growing';
  if (recentAvg < olderAvg * 0.9) return 'declining';
  return 'stable';
}

function classifyIntent(keyword, serpItems) {
  const kw = keyword.toLowerCase();
  if (/^(what is|how to|how does|why|guide|tutorial|explained|definition)/.test(kw)) return 'informational';
  if (/\b(best|top|vs|versus|review|compare|comparison|alternatives?|ranked)\b/.test(kw)) return 'commercial';
  if (/\b(buy|price|pricing|cheap|discount|near me|hire|cost|order)\b/.test(kw)) return 'transactional';
  if (serpItems.length > 0 && serpItems[0].url) {
    const topDomain = new URL(serpItems[0].url).hostname;
    if (keyword.toLowerCase().includes(topDomain.split('.')[0])) return 'navigational';
  }
  return 'informational';
}

function extractSerpFeatures(items) {
  const featureMap = {
    featured_snippet: 'featured_snippet',
    people_also_ask: 'people_also_ask',
    video: 'video_pack',
    image: 'image_pack',
    local_pack: 'local_pack',
  };
  const found = [];
  for (const item of items) {
    for (const [key, val] of Object.entries(featureMap)) {
      if (item.type && item.type.includes(key) && !found.includes(val)) {
        found.push(val);
      }
    }
  }
  return found;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getKeywordData };
