// server/index.js — BizWisdom SEO Tool server
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRoutes);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  const mockMode = process.env.MOCK_MODE === 'true';
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║    BizWisdom SEO Tool — Running          ║');
  console.log(`  ║    http://localhost:${PORT}                  ║`);
  console.log(`  ║    Mode: ${mockMode ? '⚡ MOCK (no API keys needed)  ' : '🔑 LIVE (using real APIs)    '}║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  if (mockMode) {
    console.log('  ℹ️  Running in mock mode. Set MOCK_MODE=false in .env to use real APIs.');
    console.log('');
  }
});
