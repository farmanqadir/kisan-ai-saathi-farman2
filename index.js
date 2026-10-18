const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Frontend UI Serve Karein
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serverless Handler Redirect
app.use('/api/chat', (req, res) => {
  const handler = require('./api/chat.js');
  return handler(req, res);
});

module.exports = app;
