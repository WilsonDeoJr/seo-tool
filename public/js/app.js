// app.js — BizWisdom SEO Tool frontend

let currentValidationData = null;
let editingClientId = null;

// ── Initialise ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  loadClients();
});

// ── Status check ──────────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const data = await api('/api/status');
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (data.mock_mode) {
      dot.className = 'status-dot mock';
      text.textContent = 'Mock mode';
    } else {
      dot.className = 'status-dot live';
      text.textContent = 'Live APIs';
    }
    renderApiStatus(data);
  } catch {
    document.getElementById('statusText').textContent = 'Offline';
  }
}

function renderApiStatus(data) {
  const grid = document.getElementById('apiStatusGrid');
  const mockDiv = document.getElementById('mockModeStatus');
  if (!grid) return;

  const apis = [
    { name: 'Google Gemini', key: 'gemini' },
    { name: 'Firecrawl', key: 'firecrawl' },
    { name: 'Jina.ai', key: 'jina' },
  ];

  grid.innerHTML = apis.map(a => `
    <div class="api-status-item">
      <div class="api-dot ${data.apis_configured[a.key] ? 'ok' : 'missing'}"></div>
      <div class="api-name">${a.name}</div>
      <div class="api-status-text">${data.apis_configured[a.key] ? 'Configured' : 'Not set'}</div>
    </div>
  `).join('');

  if (mockDiv) {
    mockDiv.innerHTML = `
      <div class="compliance-item ${data.mock_mode ? 'warn' : 'pass'}">
        ${data.mock_mode ? '⚡' : '✓'}
        ${data.mock_mode
          ? 'Running in <strong>mock mode</strong> — simulated data only. Set <code>MOCK_MODE=false</code> in .env and restart to use real APIs.'
          : 'Running with <strong>live APIs</strong>.'}
      </div>`;
  }
}

// ── View navigation ────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  if (name === 'clients') renderClientsGrid();
  if (name === 'settings') checkStatus();
}

// ── Client management ─────────────────────────────────────────────────────────
async function loadClients() {
  const clients = await api('/api/clients');
  const sel = document.getElementById('clientSelect');
  sel.innerHTML = '<option value="">Select client...</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  return clients;
}

async function renderClientsGrid() {
  const clients = await api('/api/clients');
  const grid = document.getElementById('clientsGrid');

  if (!clients.length) {
    grid.innerHTML = `<div style="color:var(--text3);padding:40px;text-align:center;grid-column:1/-1">No clients yet. Add your first client to get started.</div>`;
    return;
  }

  grid.innerHTML = clients.map(c => `
    <div class="client-card">
      <div class="client-name">${c.name}</div>
      <div class="client-domain">${c.domain || 'No domain set'}</div>
      <div class="client-meta">
        <span class="badge badge-accent">DA ${c.domain_authority || '?'}</span>
        <span class="badge badge-grey">${c.english_variant === 'en-US' ? '🇺🇸 US' : c.english_variant === 'en-AU' ? '🇦🇺 AU' : '🇬🇧 UK'}</span>
        <span class="badge badge-grey">${c.output_format?.toUpperCase() || 'DOCX'}</span>
        ${c.competitor_blacklist?.length ? `<span class="badge badge-red">${c.competitor_blacklist.length} blacklisted</span>` : ''}
      </div>
      <div class="client-actions">
        <button class="btn btn-ghost btn-sm" onclick="editClient('${c.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteClient('${c.id}', '${c.name}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function showClientModal(clientId = null) {
  editingClientId = clientId;
  document.getElementById('modalTitle').textContent = clientId ? 'Edit Client' : 'Add Client';

  if (clientId) {
    api('/api/clients').then(clients => {
      const c = clients.find(cl => cl.id === clientId);
      if (!c) return;
      document.getElementById('cName').value = c.name || '';
      document.getElementById('cDomain').value = c.domain || '';
      document.getElementById('cDA').value = c.domain_authority || '';
      document.getElementById('cEnglish').value = c.english_variant || 'en-AU';
      document.getElementById('cOutput').value = c.output_format || 'docx';
      document.getElementById('cTolerance').value = c.word_count_tolerance || 20;
      document.getElementById('cTone').value = c.tone || '';
      document.getElementById('cSitemap').value = c.sitemap_url || '';
      document.getElementById('cBlacklist').value = (c.competitor_blacklist || []).join(', ');
      document.getElementById('cBanned').value = (c.banned_words || []).join(', ');
      document.getElementById('cNoEmDashes').checked = c.no_em_dashes !== false;
      document.getElementById('cNoContractions').checked = c.no_contractions || false;
      document.getElementById('cGeoBox').checked = c.geo_callout_box !== false;
    });
  } else {
    // Reset form
    ['cName','cDomain','cDA','cTone','cSitemap','cBlacklist','cBanned'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('cTolerance').value = '20';
    document.getElementById('cEnglish').value = 'en-AU';
    document.getElementById('cOutput').value = 'docx';
    document.getElementById('cNoEmDashes').checked = true;
    document.getElementById('cNoContractions').checked = false;
    document.getElementById('cGeoBox').checked = true;
  }

  document.getElementById('clientModal').classList.remove('hidden');
}

function hideClientModal() {
  document.getElementById('clientModal').classList.add('hidden');
  editingClientId = null;
}

async function saveClient() {
  const data = {
    name: document.getElementById('cName').value.trim(),
    domain: document.getElementById('cDomain').value.trim(),
    domain_authority: parseInt(document.getElementById('cDA').value) || 20,
    english_variant: document.getElementById('cEnglish').value,
    output_format: document.getElementById('cOutput').value,
    word_count_tolerance: parseInt(document.getElementById('cTolerance').value) || 20,
    tone: document.getElementById('cTone').value.trim(),
    sitemap_url: document.getElementById('cSitemap').value.trim(),
    competitor_blacklist: document.getElementById('cBlacklist').value.split(',').map(s => s.trim()).filter(Boolean),
    banned_words: document.getElementById('cBanned').value.split(',').map(s => s.trim()).filter(Boolean),
    no_em_dashes: document.getElementById('cNoEmDashes').checked,
    no_contractions: document.getElementById('cNoContractions').checked,
    geo_callout_box: document.getElementById('cGeoBox').checked,
  };

  if (!data.name) { alert('Client name is required.'); return; }

  try {
    if (editingClientId) {
      await api(`/api/clients/${editingClientId}`, 'PUT', data);
    } else {
      await api('/api/clients', 'POST', data);
    }
    hideClientModal();
    loadClients();
    renderClientsGrid();
  } catch (err) {
    alert('Error saving client: ' + err.message);
  }
}

function editClient(id) {
  showView('clients');
  showClientModal(id);
}

async function deleteClient(id, name) {
  if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return;
  await api(`/api/clients/${id}`, 'DELETE');
  loadClients();
  renderClientsGrid();
}

// ── Phase 1: Validation ───────────────────────────────────────────────────────
async function runValidation() {
  const keyword = document.getElementById('keywordInput').value.trim();
  const clientId = document.getElementById('clientSelect').value;
  const location = document.getElementById('locationSelect').value;

  if (!keyword) { alert('Please enter a keyword.'); return; }
  if (!clientId) { alert('Please select a client.'); return; }

  document.getElementById('validateBtn').disabled = true;
  document.getElementById('resultsArea').innerHTML = '';
  showPipeline();
  setPipelineStep('keyword', 'active', 'Generating keyword data with Gemini...');

  try {
    const data = await api('/api/validate', 'POST', { keyword, client_id: clientId, location });
    currentValidationData = data;

    setPipelineStep('keyword', 'done');
    setPipelineStep('rankability', 'active', 'Calculating rankability score...');
    await sleep(300);
    setPipelineStep('rankability', 'done');
    setPipelineStep('cannibal', 'active', 'Checking for cannibalisation...');
    await sleep(300);
    setPipelineStep('cannibal', 'done');
    setPipelineMessage('Phase 1 complete. Review results below.');

    renderValidationResults(data);

  } catch (err) {
    setPipelineStep('keyword', 'error');
    setPipelineMessage('Error: ' + err.message);
    document.getElementById('resultsArea').innerHTML = errorCard(err.message);
  }

  document.getElementById('validateBtn').disabled = false;
}

function renderValidationResults(data) {
  const { keyword_data: kd, rankability: r, cannibalisation: c } = data;
  const verdictIcons = { GREEN: '✅', AMBER: '⚠️', RED: '🚫' };

  let html = `
    <!-- Verdict banner -->
    <div class="verdict-banner ${r.color}">
      <div class="verdict-icon">${verdictIcons[r.verdict]}</div>
      <div class="verdict-content">
        <div class="verdict-label">${r.verdict} — ${r.verdict === 'GREEN' ? 'Proceed' : r.verdict === 'AMBER' ? 'Proceed with caution' : 'Stop'}</div>
        <div class="verdict-message">${r.message}</div>
        ${c.conflict_found ? `<div style="margin-top:8px;font-size:13px;color:var(--amber)">⚠️ Cannibalisation risk: <a href="${c.conflicting_url}" target="_blank" style="color:var(--amber)">${c.conflicting_url}</a></div>` : ''}
      </div>
      <div class="verdict-score">${r.score}</div>
    </div>

    <!-- Keyword stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Estimated Demand</div>
        <div class="stat-value accent">${(kd.volume || 0).toLocaleString()}</div>
        <div class="stat-sub">AI-estimated monthly range</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Estimated Difficulty</div>
        <div class="stat-value ${kd.difficulty >= 60 ? 'red' : kd.difficulty >= 40 ? 'amber' : 'green'}">${kd.difficulty}</div>
        <div class="stat-sub">out of 100</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Commercial Value</div>
        <div class="stat-value">\$${(kd.cpc || 0).toFixed(2)}</div>
        <div class="stat-sub">AI-estimated CPC signal</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Intent</div>
        <div class="stat-value" style="font-size:18px;padding-top:6px">${intentEmoji(kd.intent)} ${cap(kd.intent)}</div>
        <div class="stat-sub">${contentTypeForIntent(kd.intent)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Trend</div>
        <div class="stat-value ${kd.trend === 'growing' ? 'green' : kd.trend === 'declining' ? 'red' : ''}" style="font-size:20px;padding-top:8px">${trendIcon(kd.trend)} ${cap(kd.trend)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">DA Gap</div>
        <div class="stat-value ${r.daGap > 20 ? 'red' : r.daGap > 10 ? 'amber' : 'green'}">${r.daGap > 0 ? '+' : ''}${r.daGap}</div>
        <div class="stat-sub">vs avg competitor DA ${r.avgCompetitorDA}</div>
      </div>
    </div>
    ${kd.data_source ? `<div class="card"><div class="card-body" style="font-size:13px;color:var(--text3)">Data source: ${kd.data_source}</div></div>` : ''}`;

  // SERP features
  if (kd.serp_features && kd.serp_features.length) {
    html += `
    <div class="card">
      <div class="card-header">SERP Features Detected</div>
      <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap">
        ${kd.serp_features.map(f => `<span class="badge badge-accent">${serpFeatureLabel(f)}</span>`).join('')}
      </div>
    </div>`;
  }

  // Top 10
  html += `
    <div class="card">
      <div class="card-header">Current Top Results</div>
      <div>
        <table class="data-table">
          <thead><tr><th>#</th><th>Title</th><th>Domain</th><th>DA</th><th>Words</th><th>Published</th></tr></thead>
          <tbody>
            ${(kd.top_10 || []).slice(0,5).map((r, i) => `
              <tr>
                <td style="color:var(--text3)">${i+1}</td>
                <td><a href="${r.url}" target="_blank">${r.title || r.domain}</a></td>
                <td class="text-mono" style="font-size:12px">${r.domain}</td>
                <td><span class="badge ${r.da >= 60 ? 'badge-red' : r.da >= 40 ? 'badge-amber' : 'badge-green'}">${r.da}</span></td>
                <td>${(r.word_count || '?').toLocaleString()}</td>
                <td style="color:var(--text3);font-size:12px">${r.published || '?'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  // PAA Questions
  if (kd.paa_questions && kd.paa_questions.length) {
    html += `
    <div class="card">
      <div class="card-header">People Also Ask</div>
      <div class="card-body">
        ${kd.paa_questions.map(q => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">❓ ${q}</div>`).join('')}
      </div>
    </div>`;
  }

  // Related keywords
  if (kd.related_keywords && kd.related_keywords.length) {
    html += `
    <div class="card">
      <div class="card-header">Related Keywords</div>
      <div class="card-body">
        <div class="kw-chips">
          ${kd.related_keywords.map(k => `
            <span class="kw-chip" onclick="useKeyword('${k.keyword}')" title="Vol: ${k.volume} | Diff: ${k.difficulty}">
              ${k.keyword}
              <span style="color:var(--text3);margin-left:4px;font-size:11px">${k.volume?.toLocaleString() || '?'}</span>
            </span>`).join('')}
        </div>
      </div>
    </div>`;
  }

  // Alternatives if amber/red
  if (r.alternatives && r.alternatives.length) {
    html += `
    <div class="card">
      <div class="card-header">Recommended Alternative Keywords</div>
      <div>
        ${r.alternatives.map(alt => `
          <div class="alt-item">
            <div class="alt-keyword">${alt.keyword}</div>
            <div class="alt-score"><span class="badge badge-green">Score ${alt.score}</span></div>
            <div class="alt-reason">${alt.reason}</div>
            <div class="alt-use"><button class="btn btn-ghost btn-sm" onclick="useKeyword('${alt.keyword}')">Use this</button></div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // Proceed / Stop
  if (r.verdict !== 'RED') {
    html += `
    <div style="display:flex;gap:12px;align-items:center;padding:8px 0">
      <button class="btn btn-primary btn-lg" onclick="runExecution()">
        <span class="btn-icon">✍️</span> Proceed to Content Execution
      </button>
      <span style="color:var(--text3);font-size:13px">
        ${r.verdict === 'AMBER' ? 'Running with caution — link building recommended post-publish.' : 'Ready to write.'}
      </span>
    </div>`;
  }

  document.getElementById('resultsArea').innerHTML = html;
}

// ── Phase 2: Content Execution ────────────────────────────────────────────────
async function runExecution() {
  if (!currentValidationData) return;

  const { keyword, client } = currentValidationData;

  document.getElementById('resultsArea').innerHTML = '';
  setPipelineStep('serp', 'active', 'Scraping top 3 organic results...');

  try {
    const data = await api('/api/execute', 'POST', {
      keyword,
      client_id: client.id,
      keyword_data: currentValidationData.keyword_data,
    });

    setPipelineStep('serp', 'done');
    setPipelineStep('writing', 'active', 'Writing article...');
    await sleep(200);
    setPipelineStep('writing', 'done');
    setPipelineStep('compliance', 'active', 'Running compliance audit...');
    await sleep(200);
    setPipelineStep('compliance', 'done');
    setPipelineMessage('✓ Article generated. Review below.');

    renderExecutionResults(data);

  } catch (err) {
    setPipelineStep('serp', 'error');
    setPipelineMessage('Error: ' + err.message);
    document.getElementById('resultsArea').innerHTML = errorCard(err.message);
  }
}

function renderExecutionResults(data) {
  const { gap_analysis: ga, article: art, citations: cit, summary: sum } = data;

  let html = `
    <!-- Summary bar -->
    <div class="verdict-banner ${sum.ready_to_deliver ? 'green' : 'amber'}">
      <div class="verdict-icon">${sum.ready_to_deliver ? '✅' : '⚠️'}</div>
      <div class="verdict-content">
        <div class="verdict-label">${sum.ready_to_deliver ? 'Ready to Deliver' : 'Review Required'}</div>
        <div class="verdict-message">
          Word count: <strong>${sum.word_count}</strong> / target ${sum.target} 
          ${sum.on_target ? '✓' : '(off target)'} &nbsp;·&nbsp;
          Compliance: <strong>${sum.compliance_passed ? 'Passed' : 'Issues found'}</strong> &nbsp;·&nbsp;
          Patches applied: <strong>${sum.patches_applied}</strong>
        </div>
      </div>
    </div>

    <!-- Compliance audit -->
    <div class="card">
      <div class="card-header">Compliance Audit</div>
      <div class="card-body">
        <div class="compliance-list">
          ${complianceItem(!art.compliance.em_dashes_found, 'No em dashes', art.compliance.em_dashes_found ? 'Em dashes found — auto-fixed' : 'Clean')}
          ${complianceItem(art.compliance.blacklist_hits.length === 0, 'Competitor blacklist', art.compliance.blacklist_hits.length ? 'Hits: ' + art.compliance.blacklist_hits.join(', ') : 'No blacklisted domains found')}
          ${complianceItem(art.compliance.banned_word_hits.length === 0, 'Banned words in headings', art.compliance.banned_word_hits.length ? 'Found: ' + art.compliance.banned_word_hits.join(', ') : 'None found')}
          ${complianceItem(art.compliance.has_faq, 'FAQ section', art.compliance.has_faq ? 'Present' : 'Missing')}
          ${complianceItem(sum.on_target, 'Word count', `${sum.word_count} words (target: ${sum.target})`)}
          ${cit.results.length ? complianceItem(cit.passed, 'Citations', `${cit.total_checked} checked · ${cit.blocked_count} blocked · ${cit.blacklisted_count} blacklisted`) : ''}
          ${art.compliance.warnings.map(w => `<div class="compliance-item warn">⚠️ ${w}</div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Gap analysis -->
    <div class="card">
      <div class="card-header">Gap Analysis — What Beats the Top 3</div>
      <div class="card-body">
        <div style="margin-bottom:14px">
          <div class="section-title">Recommended Angle</div>
          <div style="font-size:13.5px;color:var(--text);line-height:1.6">${ga.recommended_angle || ''}</div>
        </div>
        <div style="margin-bottom:14px">
          <div class="section-title">Differentiation Hook</div>
          <div style="font-size:13.5px;color:var(--accent2);line-height:1.6">${ga.differentiation_hook || ''}</div>
        </div>
        <div>
          <div class="section-title">Must-Cover Topics</div>
          ${(ga.must_cover || []).map(t => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px">• ${t}</div>`).join('')}
        </div>
      </div>
    </div>

    <!-- SERP content scraped -->
    <div class="card">
      <div class="card-header">Top 3 Analysed</div>
      <div>
        ${(data.scraped_content || []).map((sc, i) => `
          <div style="padding:14px 20px;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span style="background:var(--bg3);padding:2px 8px;border-radius:4px;font-size:11px;color:var(--text3)">#${i+1}</span>
              <a href="${sc.url}" target="_blank" style="font-weight:500;color:var(--text)">${sc.title || sc.domain}</a>
              <span class="badge badge-grey">${sc.word_count?.toLocaleString()} words</span>
            </div>
            <div style="font-size:12px;color:var(--text3)">Headings: ${(sc.headings || []).join(' · ')}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Article output -->
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
        <span>Generated Article</span>
        <span class="badge badge-accent">${sum.word_count} words</span>
      </div>
      <div class="card-body">
        <div class="article-output" id="articleContent">${escapeHtml(art.content)}</div>
        <div class="article-actions">
          <button class="btn btn-primary" onclick="copyArticle()">📋 Copy Article</button>
          <button class="btn btn-ghost" onclick="downloadArticle('${data.keyword}')">⬇️ Download .txt</button>
        </div>
      </div>
    </div>`;

  document.getElementById('resultsArea').innerHTML = html;
}

// ── Pipeline helpers ──────────────────────────────────────────────────────────
function showPipeline() {
  const p = document.getElementById('pipelineProgress');
  p.classList.remove('hidden');
  ['keyword','rankability','cannibal','serp','writing','compliance'].forEach(s => {
    const el = document.getElementById(`step-${s}`);
    if (el) el.className = 'pipeline-step';
    const dot = el?.querySelector('.step-dot');
    if (dot) dot.textContent = '';
  });
}

function setPipelineStep(step, state, message) {
  const el = document.getElementById(`step-${step}`);
  if (el) el.className = `pipeline-step ${state}`;
  if (message) setPipelineMessage(message);
}

function setPipelineMessage(msg) {
  document.getElementById('pipelineMessage').textContent = msg;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function useKeyword(kw) {
  document.getElementById('keywordInput').value = kw;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function copyArticle() {
  const content = document.getElementById('articleContent')?.textContent || '';
  navigator.clipboard.writeText(content).then(() => {
    alert('Article copied to clipboard!');
  });
}

function downloadArticle(keyword) {
  const content = document.getElementById('articleContent')?.textContent || '';
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${keyword.replace(/\s+/g, '-')}.txt`;
  a.click();
}

function complianceItem(passed, label, detail) {
  const cls = passed ? 'pass' : 'fail';
  const icon = passed ? '✓' : '✕';
  return `<div class="compliance-item ${cls}">${icon} <strong>${label}</strong> — ${detail}</div>`;
}

function errorCard(msg) {
  return `<div class="verdict-banner red"><div class="verdict-icon">🚫</div><div class="verdict-content"><div class="verdict-label">Error</div><div class="verdict-message">${msg}</div></div></div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function intentEmoji(intent) {
  return { informational: '📖', commercial: '🔍', transactional: '🛒', navigational: '🧭' }[intent] || '📄';
}

function contentTypeForIntent(intent) {
  return { informational: 'Educational article', commercial: 'Comparison/roundup', transactional: 'Landing page', navigational: 'Brand page' }[intent] || 'Article';
}

function trendIcon(trend) { return { growing: '📈', declining: '📉', stable: '➡️' }[trend] || '➡️'; }

function serpFeatureLabel(f) {
  return { featured_snippet: '⭐ Featured Snippet', people_also_ask: '❓ People Also Ask', video_pack: '🎬 Video Pack', image_pack: '🖼️ Image Pack', local_pack: '📍 Local Pack' }[f] || f;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
