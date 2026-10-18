const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Frontend Serve karne ke liye
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Route Redirect/Handler
app.post('/api/chat', async (req, res) => {
  try {
    const handler = require('./api/chat');
    return await handler(req, res);
  } catch (err) {
    return res.status(500).json({ reply: "Server route error: " + err.message });
  }
});

module.exports = app;
