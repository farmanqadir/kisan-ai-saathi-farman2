const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serve Static Frontend (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

// Direct Chat API route within index.js (to avoid missing file issues)
app.post('/api/chat', async (req, res) => {
  try {
    const chatHandler = require('./api/chat.js');
    return await chatHandler(req, res);
  } catch (err) {
    return res.status(500).json({ reply: "API Error: " + err.message });
  }
});

module.exports = app;
