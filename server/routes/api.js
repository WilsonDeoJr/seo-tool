// routes/api.js — All API endpoints
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { getKeywordData } = require('../modules/keyword');
const { calculateRankability } = require('../modules/rankability');
const { scrapeTopResults, runGapAnalysis } = require('../modules/serp');
const { checkCannibalisation } = require('../modules/cannibalisation');
const { writeArticle, countWords } = require('../modules/writer');
const { validateCitations } = require('../modules/citations');

const CLIENTS_FILE = path.join(__dirname, '../../data/clients.json');

function getClients() {
  return JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8')).clients;
}

function saveClients(clients) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify({ clients }, null, 2));
}

function getClient(id) {
  return getClients().find(c => c.id === id);
}

// ── Client management ──────────────────────────────────────────────────────────
router.get('/clients', (req, res) => {
  res.json(getClients());
});

router.post('/clients', (req, res) => {
  const clients = getClients();
  const newClient = {
    id: req.body.name.toLowerCase().replace(/\s+/g, '-'),
    ...req.body,
    word_count_tolerance: parseInt(req.body.word_count_tolerance) || 20,
    domain_authority: parseInt(req.body.domain_authority) || 20,
    banned_words: Array.isArray(req.body.banned_words) ? req.body.banned_words : (req.body.banned_words || '').split(',').map(s => s.trim()).filter(Boolean),
    competitor_blacklist: Array.isArray(req.body.competitor_blacklist) ? req.body.competitor_blacklist : (req.body.competitor_blacklist || '').split(',').map(s => s.trim()).filter(Boolean),
  };
  if (clients.find(c => c.id === newClient.id)) {
    return res.status(400).json({ error: 'Client with this name already exists' });
  }
  clients.push(newClient);
  saveClients(clients);
  res.json(newClient);
});

router.put('/clients/:id', (req, res) => {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Client not found' });
  clients[idx] = { ...clients[idx], ...req.body };
  saveClients(clients);
  res.json(clients[idx]);
});

router.delete('/clients/:id', (req, res) => {
  let clients = getClients();
  clients = clients.filter(c => c.id !== req.params.id);
  saveClients(clients);
  res.json({ success: true });
});

// ── Phase 1: Opportunity Validation ───────────────────────────────────────────
router.post('/validate', async (req, res) => {
  const { keyword, client_id, location } = req.body;

  if (!keyword || !client_id) {
    return res.status(400).json({ error: 'keyword and client_id are required' });
  }

  const client = getClient(client_id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  try {
    // Step 1: Keyword data
    const keywordData = await getKeywordData(keyword, location || 'Australia');

    // Step 2: Rankability score
    const rankability = calculateRankability(keyword, client, keywordData);

    // Step 3: Cannibalisation check
    const cannibalisation = await checkCannibalisation(keyword, client);

    res.json({
      keyword,
      client: { id: client.id, name: client.name, domain: client.domain, domain_authority: client.domain_authority },
      keyword_data: keywordData,
      rankability,
      cannibalisation,
      recommendation: rankability.verdict === 'RED' ? 'stop' : 'proceed'
    });

  } catch (err) {
    console.error('Validate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Phase 2: Content Execution ─────────────────────────────────────────────────
router.post('/execute', async (req, res) => {
  const { keyword, client_id, keyword_data, override_verdict } = req.body;

  if (!keyword || !client_id) {
    return res.status(400).json({ error: 'keyword and client_id are required' });
  }

  const client = getClient(client_id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Use provided keyword_data or re-fetch
  let kwData = keyword_data;
  if (!kwData) {
    try {
      kwData = await getKeywordData(keyword);
    } catch (err) {
      return res.status(500).json({ error: 'Could not fetch keyword data: ' + err.message });
    }
  }

  try {
    // Step 1: Scrape top results
    const topUrls = (kwData.top_10 || []).slice(0, 3).map(r => r.url);
    const scrapedContent = await scrapeTopResults(topUrls);

    // Step 2: Gap analysis
    const gapAnalysis = await runGapAnalysis(keyword, scrapedContent, kwData.paa_questions || []);

    // Step 3: Write article
    const article = await writeArticle(keyword, gapAnalysis, client, kwData);

    // Step 4: Validate citations
    const citations = await validateCitations(article.content, client);

    res.json({
      keyword,
      client: { id: client.id, name: client.name },
      scraped_content: scrapedContent.map(s => ({
        url: s.url,
        domain: s.domain,
        title: s.title,
        word_count: s.word_count,
        headings: s.headings
      })),
      gap_analysis: gapAnalysis,
      article,
      citations,
      summary: {
        word_count: article.word_count,
        target: gapAnalysis.recommended_word_count,
        on_target: Math.abs(article.word_count - gapAnalysis.recommended_word_count) <= (client.word_count_tolerance || 20),
        compliance_passed: article.compliance.passed,
        citations_passed: citations.passed,
        patches_applied: article.patches_applied,
        ready_to_deliver: article.compliance.passed && citations.passed
      }
    });

  } catch (err) {
    console.error('Execute error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Status check ───────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const mockMode = process.env.MOCK_MODE === 'true';
  res.json({
    status: 'running',
    mock_mode: mockMode,
    apis_configured: {
      gemini: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_key_here',
      dataforseo: !!process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_LOGIN !== 'your_dataforseo_login_here',
      firecrawl: !!process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY !== 'your_firecrawl_key_here',
      jina: !!process.env.JINA_API_KEY && process.env.JINA_API_KEY !== 'your_jina_key_here',
    }
  });
});

module.exports = router;
