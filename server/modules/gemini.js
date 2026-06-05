// gemini.js — shared Gemini API helper
const axios = require('axios');

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is missing. Add it in your .env file or Render environment variables.');
  }

  return { apiKey, model };
}

async function callGemini(userPrompt, systemPrompt = '', options = {}) {
  const { apiKey, model } = getGeminiConfig();
  const maxOutputTokens = options.maxOutputTokens || 2000;
  const temperature = options.temperature ?? 0.4;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature,
      maxOutputTokens
    }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const res = await axios.post(endpoint, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: options.timeout || 60000
  });

  const text = res.data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

function parseJsonFromText(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini response did not contain valid JSON.');
    return JSON.parse(match[0]);
  }
}

module.exports = { callGemini, parseJsonFromText };
