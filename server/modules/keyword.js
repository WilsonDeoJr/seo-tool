// keyword.js — Keyword intelligence via Gemini
const { mockKeywordData } = require('./mock');
const { callGemini, parseJsonFromText } = require('./gemini');

const isMock = () => process.env.MOCK_MODE === 'true';

async function getKeywordData(keyword, location = 'Australia') {
  if (isMock()) {
    await delay(800);
    return mockKeywordData(keyword);
  }

  const prompt = `Generate SEO keyword research data for the keyword "${keyword}" in ${location}.

Important: You do not have access to live Google Ads keyword data. Return cautious AI-estimated planning data only. Do not invent exact claims. Use relative estimates that are useful for portfolio/demo testing.

Return JSON only. No markdown fences. Use this exact structure:
{
  "keyword": "string",
  "volume": number,
  "difficulty": number,
  "cpc": number,
  "trend": "growing" | "stable" | "declining",
  "intent": "informational" | "commercial" | "transactional" | "navigational",
  "serp_features": ["featured_snippet", "people_also_ask", "image_pack", "video_pack", "local_pack"],
  "related_keywords": [
    { "keyword": "string", "volume": number, "difficulty": number }
  ],
  "top_10": [
    { "url": "https://example.com/page", "domain": "example.com", "da": number, "title": "string", "word_count": number, "published": "YYYY-MM-DD" }
  ],
  "paa_questions": ["string"],
  "data_source": "Gemini AI estimate"
}

Rules:
- difficulty must be 0 to 100.
- volume must be a rounded monthly estimate, not a claim of live data.
- cpc can be 0 if the query is not commercial.
- related_keywords should have 5 to 8 items.
- top_10 should have 5 realistic likely result types. If unsure about a URL, use a generic placeholder URL from a relevant authority domain, but keep it valid.
- paa_questions should have 5 useful questions.`;

  try {
    const text = await callGemini(
      prompt,
      'You are an SEO research assistant. Return valid JSON only. Be cautious and label values as AI estimates, not live API data.',
      { maxOutputTokens: 3500, temperature: 0.3 }
    );

    const data = parseJsonFromText(text);

    return normalizeKeywordData(data, keyword);
  } catch (err) {
    console.error('Gemini keyword data error:', err.response?.data || err.message);
    throw new Error('Keyword data fetch failed. Check your Gemini API key and model setting.');
  }
}

function normalizeKeywordData(data, fallbackKeyword) {
  const top10 = Array.isArray(data.top_10) ? data.top_10 : [];
  const related = Array.isArray(data.related_keywords) ? data.related_keywords : [];

  return {
    keyword: data.keyword || fallbackKeyword,
    volume: toNumber(data.volume, 0),
    difficulty: clamp(toNumber(data.difficulty, 35), 0, 100),
    cpc: toNumber(data.cpc, 0),
    trend: ['growing', 'stable', 'declining'].includes(data.trend) ? data.trend : 'stable',
    intent: ['informational', 'commercial', 'transactional', 'navigational'].includes(data.intent)
      ? data.intent
      : classifyIntent(fallbackKeyword, top10),
    serp_features: Array.isArray(data.serp_features) ? data.serp_features : ['people_also_ask'],
    related_keywords: related.slice(0, 8).map(item => ({
      keyword: item.keyword || fallbackKeyword,
      volume: toNumber(item.volume, 0),
      difficulty: clamp(toNumber(item.difficulty, 35), 0, 100)
    })),
    top_10: top10.slice(0, 10).map((item, index) => normalizeSerpItem(item, index)),
    paa_questions: Array.isArray(data.paa_questions) ? data.paa_questions.slice(0, 8) : [],
    data_source: 'Gemini AI estimate, not live Google Ads data'
  };
}

function normalizeSerpItem(item, index) {
  let url = item.url || `https://example.com/result-${index + 1}`;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let domain = item.domain;
  try { domain = domain || new URL(url).hostname; } catch { domain = 'example.com'; }

  return {
    url,
    domain,
    da: clamp(toNumber(item.da, 40 + index * 3), 1, 100),
    title: item.title || domain,
    word_count: toNumber(item.word_count, 1500),
    published: item.published || '2024-01-01'
  };
}

function classifyIntent(keyword, serpItems = []) {
  const kw = keyword.toLowerCase();
  if (/^(what is|how to|how does|why|guide|tutorial|explained|definition)/.test(kw)) return 'informational';
  if (/\b(best|top|vs|versus|review|compare|comparison|alternatives?|ranked)\b/.test(kw)) return 'commercial';
  if (/\b(buy|price|pricing|cheap|discount|near me|hire|cost|order)\b/.test(kw)) return 'transactional';
  if (serpItems.length > 0 && serpItems[0].url) {
    try {
      const topDomain = new URL(serpItems[0].url).hostname;
      if (kw.includes(topDomain.split('.')[0])) return 'navigational';
    } catch {}
  }
  return 'informational';
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getKeywordData };
