const express = require('express');
const cors = require('cors');
const { products } = require('./mockData');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/products', (req, res) => {
  res.json(products);
});

module.exports = app;
