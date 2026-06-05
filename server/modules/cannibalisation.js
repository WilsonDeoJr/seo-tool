// cannibalisation.js — Checks client sitemap for existing competing pages
const axios = require('axios');
const xml2js = require('xml2js');
const { mockCannibalisation } = require('./mock');

const isMock = () => process.env.MOCK_MODE === 'true';

async function checkCannibalisation(keyword, client) {
  if (isMock()) {
    return mockCannibalisation(keyword, client.sitemap_url);
  }

  if (!client.sitemap_url) {
    return {
      checked: false,
      conflict_found: false,
      conflicting_url: null,
      message: 'No sitemap URL configured for this client. Skipped.'
    };
  }

  try {
    const res = await axios.get(client.sitemap_url, { timeout: 10000 });
    const parsed = await xml2js.parseStringPromise(res.data);

    let urls = [];
    // Handle standard sitemap
    if (parsed.urlset && parsed.urlset.url) {
      urls = parsed.urlset.url.map(u => u.loc[0]);
    }
    // Handle sitemap index
    if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
      const sitemapUrls = parsed.sitemapindex.sitemap.map(s => s.loc[0]);
      for (const sitemapUrl of sitemapUrls.slice(0, 5)) {
        try {
          const subRes = await axios.get(sitemapUrl, { timeout: 8000 });
          const subParsed = await xml2js.parseStringPromise(subRes.data);
          if (subParsed.urlset && subParsed.urlset.url) {
            urls.push(...subParsed.urlset.url.map(u => u.loc[0]));
          }
        } catch { /* skip failed sub-sitemaps */ }
      }
    }

    // Check for keyword matches in URLs
    const keywordSlug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const keywordWords = keyword.toLowerCase().split(/\s+/);

    const conflictingUrl = urls.find(url => {
      const urlLower = url.toLowerCase();
      // Direct slug match
      if (urlLower.includes(keywordSlug)) return true;
      // Most keyword words appear in URL
      const wordMatches = keywordWords.filter(w => w.length > 3 && urlLower.includes(w));
      return wordMatches.length >= Math.ceil(keywordWords.length * 0.6);
    });

    if (conflictingUrl) {
      return {
        checked: true,
        conflict_found: true,
        conflicting_url: conflictingUrl,
        message: `Potential cannibalisation risk detected. An existing page may already target this keyword. Consider updating the existing page instead of creating a new one, or choose a more specific keyword angle.`
      };
    }

    return {
      checked: true,
      conflict_found: false,
      conflicting_url: null,
      message: `No existing pages found targeting "${keyword}". Clear to proceed.`
    };

  } catch (err) {
    console.error('Cannibalisation check error:', err.message);
    return {
      checked: false,
      conflict_found: false,
      conflicting_url: null,
      message: `Sitemap could not be fetched: ${err.message}`
    };
  }
}

module.exports = { checkCannibalisation };
