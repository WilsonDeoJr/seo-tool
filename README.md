# BizWisdom SEO Content Intelligence Tool

Autonomous SEO/GEO/AEO content pipeline. Validates keyword rankability before writing, 
analyses the top 3 ranking articles, and generates fully compliant, formatted content.

---

## Quick Start

### 1. Install dependencies
```bash
cd seo-tool
npm install
```

### 2. Start the app (mock mode — no API keys needed)
```bash
npm start
```

Open your browser at: **http://localhost:3000**

The app runs in mock mode by default — all pipeline steps work with simulated data.

---

## Going Live (adding real API keys)

Edit the `.env` file and add your keys:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=yourpassword
FIRECRAWL_API_KEY=fc-...
JINA_API_KEY=jina_...
MOCK_MODE=false
```

Then restart:
```bash
npm start
```

### Where to get the keys

| API | URL | Notes |
|-----|-----|-------|
| Gemini | https://aistudio.google.com/app/apikey | Required for gap analysis and article writing |
| DataForSEO | https://dataforseo.com | Required for keyword data |
| Firecrawl | https://firecrawl.dev | Required for SERP scraping |
| Jina.ai | https://jina.ai | Free tier available — fallback scraper |

---

## Project Structure

```
seo-tool/
├── .env                      ← API keys go here
├── package.json
├── data/
│   └── clients.json          ← Client profiles (editable via UI)
├── public/
│   ├── index.html            ← Frontend UI
│   ├── css/app.css
│   └── js/app.js
└── server/
    ├── index.js              ← Express server entry point
    ├── routes/
    │   └── api.js            ← All API endpoints
    └── modules/
        ├── keyword.js        ← DataForSEO keyword intelligence
        ├── rankability.js    ← Rankability scoring
        ├── serp.js           ← SERP scraping + gap analysis
        ├── cannibalisation.js ← Sitemap cannibalisation check
        ├── writer.js         ← Article generation + word count loop
        ├── citations.js      ← robots.txt + blacklist validation
        └── mock.js           ← Simulated data for testing
```

---

## How It Works

### Phase 1 — Opportunity Validation
1. Fetches keyword data (volume, difficulty, CPC, intent, SERP features)
2. Calculates rankability score for the client's domain
3. Returns GREEN / AMBER / RED verdict
4. Checks client sitemap for cannibalisation risk

### Phase 2 — Content Execution (only after GREEN or AMBER)
1. Scrapes top 3 organic results
2. Runs Gemini gap analysis — identifies what competitors miss
3. Generates a content brief
4. Writes the article with Gemini and word count enforcement loop
5. Runs compliance audit (blacklist, banned words, em dashes, citations)
6. Returns formatted output

---

## Development (auto-restart on file changes)
```bash
npm run dev
```
Requires nodemon (installed as dev dependency).

---

## Adding a New Client
1. Go to the **Clients** tab in the UI
2. Click **Add Client**
3. Fill in the profile — domain, DA, English variant, blacklist, banned words, output format
4. Save — the client is immediately available in the generator

No code changes required to add clients.
