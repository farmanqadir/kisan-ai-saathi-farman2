const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Farman Kisan Hub API is Running');
});

module.exports = app;
