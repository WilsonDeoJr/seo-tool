// writer.js — Article generation with word count enforcement and compliance
const axios = require('axios');
const { mockArticle } = require('./mock');

const isMock = () => process.env.MOCK_MODE === 'true';

async function writeArticle(keyword, brief, client, keywordData) {
  if (isMock()) {
    await delay(2000);
    const draft = mockArticle(keyword, brief, client);
    return {
      content: draft,
      word_count: countWords(draft),
      patches_applied: 0,
      compliance: runComplianceCheck(draft, client, brief)
    };
  }

  const target = brief.recommended_word_count || 1800;
  const tolerance = client.word_count_tolerance || 20;

  let draft = await generateDraft(keyword, brief, client, keywordData, target);
  let wordCount = countWords(draft);
  let patches = 0;

  // Word count enforcement loop — max 3 patch attempts
  while (Math.abs(wordCount - target) > tolerance && patches < 3) {
    const gap = target - wordCount;
    if (gap > 0) {
      draft = await patchArticle(draft, gap, keyword, client);
    } else {
      draft = await trimArticle(draft, Math.abs(gap), client);
    }
    wordCount = countWords(draft);
    patches++;
  }

  const compliance = runComplianceCheck(draft, client, brief);

  // Auto-fix what we can
  if (compliance.em_dashes_found && client.no_em_dashes) {
    draft = draft.replace(/—/g, ',');
    compliance.em_dashes_found = false;
    compliance.em_dashes_fixed = true;
  }

  return {
    content: draft,
    word_count: countWords(draft),
    target_word_count: target,
    patches_applied: patches,
    compliance
  };
}

async function generateDraft(keyword, brief, client, keywordData, target) {
  const isUS = client.english_variant === 'en-US';
  const bannedWords = (client.banned_words || []).join(', ');
  const blacklist = (client.competitor_blacklist || []).join(', ');
  const relatedKeywords = (keywordData.related_keywords || []).slice(0, 6).map(r => r.keyword).join(', ');

  const systemPrompt = `You are an expert SEO content writer. Write in ${isUS ? 'American' : 'Australian'} English.
RULES:
- Target word count: ${target} words (±${client.word_count_tolerance || 20})
- Tone: ${client.tone || 'professional and informative'}
- Never use em dashes (—). Use commas or restructure the sentence instead.
- Never mention or link to these competitor domains: ${blacklist || 'none'}
- Never use these words or phrases in headings: ${bannedWords || 'none'}
- ${client.no_contractions ? 'Do not use contractions.' : 'Contractions are acceptable.'}
- Include a 40–60 word direct answer paragraph at the start for featured snippet optimisation
- Include a FAQ section at the end addressing the provided questions
- Use markdown formatting: # for H1, ## for H2, ### for H3, **bold**, bullet lists`;

  const userPrompt = `Write a comprehensive SEO article targeting the keyword: "${keyword}"

CONTENT BRIEF:
- Unique angle: ${brief.recommended_angle}
- Differentiation hook: ${brief.differentiation_hook}
- Must-cover topics: ${(brief.must_cover || []).join('; ')}
- Suggested H2 headings: ${(brief.recommended_h2s || []).join('; ')}
- LSI keywords to include naturally: ${relatedKeywords}

FAQ QUESTIONS TO ANSWER:
${(keywordData.paa_questions || []).join('\n')}

Write the complete article now. Hit the word count target.`;

  return callGeminiAPI(userPrompt, systemPrompt, 6000);
}

async function patchArticle(draft, wordsNeeded, keyword, client) {
  const isUS = client.english_variant === 'en-US';
  const prompt = `The following article is ${wordsNeeded} words short of its target. Expand it by adding ${wordsNeeded} words of substantive, relevant content. Do not add filler. Expand existing thin sections or add a new section with practical examples or data. Return the complete expanded article.

ARTICLE:
${draft}`;

  return callGeminiAPI(prompt, `You are an expert SEO content writer. Write in ${isUS ? 'American' : 'Australian'} English. Never use em dashes.`, 7000);
}

async function trimArticle(draft, wordsOver, client) {
  const isUS = client.english_variant === 'en-US';
  const prompt = `The following article is ${wordsOver} words over target. Trim it by removing redundant content, tightening prose, or consolidating thin sections. Preserve all headings and the FAQ section. Return the complete trimmed article.

ARTICLE:
${draft}`;

  return callGeminiAPI(prompt, `You are an expert SEO content editor. Write in ${isUS ? 'American' : 'Australian'} English.`, 7000);
}

function runComplianceCheck(content, client, brief) {
  const issues = [];
  const warnings = [];

  // Em dash check
  const emDashCount = (content.match(/—/g) || []).length;
  const emDashFound = emDashCount > 0;
  if (emDashFound) issues.push(`${emDashCount} em dash(es) found`);

  // Competitor blacklist check
  const blacklistHits = [];
  for (const domain of (client.competitor_blacklist || [])) {
    if (content.toLowerCase().includes(domain.toLowerCase())) {
      blacklistHits.push(domain);
      issues.push(`Blacklisted competitor mentioned: ${domain}`);
    }
  }

  // Banned words check
  const bannedHits = [];
  for (const word of (client.banned_words || [])) {
    const regex = new RegExp(`##.*${word}.*`, 'i');
    if (regex.test(content)) {
      bannedHits.push(word);
      warnings.push(`Banned word "${word}" found in heading`);
    }
  }

  // FAQ section check
  const hasFaq = /FAQ|Frequently Asked/i.test(content);
  if (!hasFaq) warnings.push('No FAQ section detected');

  // Direct answer paragraph check (first paragraph word count)
  const firstPara = content.split('\n\n')[1] || '';
  const firstParaWords = countWords(firstPara);
  if (firstParaWords < 30 || firstParaWords > 80) {
    warnings.push(`Opening paragraph is ${firstParaWords} words — target 40–60 for featured snippet`);
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    em_dashes_found: emDashFound,
    blacklist_hits: blacklistHits,
    banned_word_hits: bannedHits,
    has_faq: hasFaq,
  };
}

function countWords(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/[#*_`\[\]]/g, '').trim().split(/\s+/).filter(Boolean).length;
}

async function callGeminiAPI(userPrompt, systemPrompt, maxOutputTokens = 4000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_key_here') {
    throw new Error('GEMINI_API_KEY is missing. Add it to your .env file or Render environment variables.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await axios.post(
    endpoint,
    {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens
      }
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(part => part.text || '').join('').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { writeArticle, countWords, runComplianceCheck };
