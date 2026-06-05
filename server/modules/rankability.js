// rankability.js — Determines if a keyword is winnable for a given client domain
const { mockRankabilityScore } = require('./mock');

const isMock = () => process.env.MOCK_MODE === 'true';

function calculateRankability(keyword, client, keywordData) {
  const { difficulty, top_10 } = keywordData;
  const clientDA = client.domain_authority || 20;

  if (isMock()) {
    return mockRankabilityScore(keyword, clientDA, difficulty, top_10);
  }

  const top5 = top_10.slice(0, 5);
  const avgCompetitorDA = top5.reduce((sum, r) => sum + (r.da || 50), 0) / top5.length;
  const daGap = avgCompetitorDA - clientDA;

  // Count stale content (older than 2 years) — opportunity signal
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const staleCount = top_10.filter(r => new Date(r.published) < twoYearsAgo).length;

  // Featured snippet present — easier to capture with structured content
  const hasSnippet = keywordData.serp_features.includes('featured_snippet');

  // Score calculation
  let score = 100;
  score -= Math.max(0, daGap * 1.2);   // DA gap penalty
  score -= difficulty * 0.4;            // keyword difficulty penalty
  score += staleCount * 8;              // stale content opportunity bonus
  score += hasSnippet ? 10 : 0;         // snippet capture bonus
  score = Math.max(5, Math.min(95, Math.round(score)));

  let verdict, color, message;
  const alternatives = generateAlternatives(keyword, score);

  if (score >= 60) {
    verdict = 'GREEN';
    color = 'green';
    message = `Winnable. The domain authority gap is manageable and content quality can be the differentiator. Proceed to content execution.`;
  } else if (score >= 35) {
    verdict = 'AMBER';
    color = 'amber';
    message = `Possible, but competitive. Strong content alone may not be sufficient. Plan for link building after publishing, and consider targeting the related keyword alternatives below first.`;
  } else {
    verdict = 'RED';
    color = 'red';
    message = `Not winnable at this domain authority level. The top-ranking sites have a DA gap of ${Math.round(daGap)} points that content quality alone cannot bridge. Target the alternatives below to build authority first.`;
  }

  return {
    score,
    verdict,
    color,
    message,
    alternatives,
    daGap: Math.round(daGap),
    avgCompetitorDA: Math.round(avgCompetitorDA),
    clientDA,
    staleCount,
    hasSnippet
  };
}

function generateAlternatives(keyword, score) {
  if (score >= 60) return [];
  return [
    { keyword: `how to ${keyword}`, score: Math.min(95, score + 28), reason: 'Informational intent, lower competition' },
    { keyword: `${keyword} guide`, score: Math.min(95, score + 22), reason: 'Long-tail variation, less competitive' },
    { keyword: `${keyword} for beginners`, score: Math.min(95, score + 18), reason: 'Niche audience, thinner competition' },
    { keyword: `what is ${keyword}`, score: Math.min(95, score + 25), reason: 'Definitional query, often lower DA requirements' },
  ];
}

module.exports = { calculateRankability };
