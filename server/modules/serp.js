// serp.js — Scrapes top organic results and runs gap analysis via Claude
const axios = require('axios');
const { mockSerpContent, mockGapAnalysis } = require('./mock');

const isMock = () => process.env.MOCK_MODE === 'true';

async function scrapeTopResults(urls) {
  if (isMock()) {
    await delay(1200);
    return mockSerpContent(urls[0] || 'example keyword');
  }

  const results = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const content = await scrapeUrl(url);
      if (content) results.push(content);
    } catch (err) {
      console.warn(`Scrape failed for ${url}:`, err.message);
    }
  }
  return results;
}

async function scrapeUrl(url) {
  // Try Firecrawl first
  if (process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY !== 'your_firecrawl_key_here') {
    try {
      const res = await axios.post(
        'https://api.firecrawl.dev/v0/scrape',
        { url, pageOptions: { onlyMainContent: true } },
        { headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (res.data.success) {
        return parseScrapedContent(url, res.data.data.markdown || res.data.data.content || '');
      }
    } catch (err) {
      console.warn('Firecrawl failed, trying Jina:', err.message);
    }
  }

  // Fallback: Jina.ai Reader
  const jinaKey = process.env.JINA_API_KEY;
  const headers = { Accept: 'application/json' };
  if (jinaKey && jinaKey !== 'your_jina_key_here') {
    headers.Authorization = `Bearer ${jinaKey}`;
  }

  const res = await axios.get(`https://r.jina.ai/${url}`, { headers, timeout: 15000 });
  return parseScrapedContent(url, res.data.data?.content || res.data || '');
}

function parseScrapedContent(url, rawContent) {
  const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

  // Extract headings
  const headings = [];
  const h2matches = content.match(/^## .+/gm) || [];
  const h3matches = content.match(/^### .+/gm) || [];
  [...h2matches, ...h3matches].forEach(h => headings.push(h.replace(/^#+\s/, '')));

  // Approximate word count
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Extract domain
  let domain = url;
  try { domain = new URL(url).hostname; } catch {}

  return {
    url,
    domain,
    title: (content.match(/^# (.+)/m) || [])[1] || domain,
    word_count: wordCount,
    headings: headings.slice(0, 12),
    raw_content: content.slice(0, 8000) // cap to avoid token overload
  };
}

async function runGapAnalysis(keyword, scrapedContent, paaQuestions) {
  if (isMock()) {
    await delay(1500);
    return mockGapAnalysis(keyword);
  }

  const contentSummary = scrapedContent.map((article, i) =>
    `Article ${i + 1} (${article.domain}, ${article.word_count} words):
Headings: ${article.headings.join(', ')}
Content excerpt: ${article.raw_content.slice(0, 1500)}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert SEO content strategist. Analyse the following top-ranking articles for the keyword "${keyword}" and produce a detailed content gap analysis.

TOP-RANKING CONTENT:
${contentSummary}

PEOPLE ALSO ASK QUESTIONS:
${paaQuestions.join('\n')}

Respond in JSON only. No preamble. No markdown fences. Use this exact structure:
{
  "recommended_angle": "string — the unique content angle that beats the top 3",
  "must_cover": ["array of specific topics/sections the new article must include"],
  "recommended_h2s": ["array of H2 heading suggestions for the new article"],
  "recommended_word_count": number,
  "differentiation_hook": "string — the one thing that makes this article stand out",
  "topics_all_cover": ["topics covered by all top 3"],
  "topics_missing": ["topics absent from top 3 — content opportunities"]
}`;

  const res = await callClaudeAPI(prompt, 'You are an expert SEO analyst. Return JSON only.');
  try {
    return JSON.parse(res.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Gap analysis response could not be parsed. Check Claude API response.');
  }
}

async function callClaudeAPI(userPrompt, systemPrompt) {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );
  return res.data.content[0].text;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeTopResults, runGapAnalysis };
