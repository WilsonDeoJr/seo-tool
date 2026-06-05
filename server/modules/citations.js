// citations.js — Validates citations against robots.txt and competitor blacklist
const axios = require('axios');

async function validateCitations(content, client) {
  // Extract all URLs from markdown content
  const urlRegex = /https?:\/\/[^\s\)\"\']+/g;
  const urls = [...new Set(content.match(urlRegex) || [])];

  const results = [];
  for (const url of urls.slice(0, 20)) { // cap at 20 to avoid slowness
    const result = await checkUrl(url, client);
    results.push(result);
  }

  const blocked = results.filter(r => r.status === 'blocked');
  const blacklisted = results.filter(r => r.status === 'blacklisted');
  const stale = results.filter(r => r.stale);

  return {
    total_checked: results.length,
    blocked_count: blocked.length,
    blacklisted_count: blacklisted.length,
    stale_count: stale.length,
    results,
    passed: blocked.length === 0 && blacklisted.length === 0
  };
}

async function checkUrl(url, client) {
  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    return { url, domain: url, status: 'invalid', stale: false };
  }

  // Competitor blacklist check
  const isBlacklisted = (client.competitor_blacklist || []).some(b =>
    domain.toLowerCase().includes(b.toLowerCase())
  );
  if (isBlacklisted) {
    return { url, domain, status: 'blacklisted', reason: 'Competitor domain', stale: false };
  }

  // robots.txt check
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const res = await axios.get(robotsUrl, { timeout: 5000 });
    const robots = res.data || '';
    const path = new URL(url).pathname;

    // Very basic robots.txt check — look for Disallow rules that match the path
    const disallowLines = robots.split('\n').filter(l => l.trim().startsWith('Disallow:'));
    const isDisallowed = disallowLines.some(line => {
      const disallowedPath = line.replace('Disallow:', '').trim();
      return disallowedPath && path.startsWith(disallowedPath);
    });

    if (isDisallowed) {
      return { url, domain, status: 'blocked', reason: 'Disallowed by robots.txt', stale: false };
    }
  } catch {
    // robots.txt not accessible — assume allowed
  }

  return { url, domain, status: 'ok', stale: false };
}

module.exports = { validateCitations };
