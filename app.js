const express = require('express');
const path = require('path');

const app = express();

// Servir archivos estáticos desde la raíz
app.use(express.static(path.join(__dirname)));

// Ruta específica para el operador
app.get('/operador', (req, res) => {
  res.sendFile(path.join(__dirname, 'operador.html'));
});

app.get('/operador.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'operador.html'));
});

// Todo lo demás → index.html (panel admin)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;