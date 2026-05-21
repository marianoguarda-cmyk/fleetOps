const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const SB_URL = 'https://rzmijsyioxtmnfjpezvb.supabase.co';
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Service Worker
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// Ruta operador
app.get('/operador', (req, res) => {
  res.sendFile(path.join(__dirname, 'operador.html'));
});
app.get('/operador.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'operador.html'));
});

// API: crear usuario sin límite de rate
app.post('/api/crear-usuario', async (req, res) => {
  const { email, password, nombre, rol, pais_id } = req.body;
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    // 1. Crear usuario con Admin API (sin límite de rate)
    const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_SERVICE_KEY,
        'Authorization': `Bearer ${SB_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,  // confirmar email automáticamente
        user_metadata: { nombre, rol, pais_id }
      })
    });
    const userData = await createRes.json();
    if (!createRes.ok) {
      return res.status(400).json({ error: userData.message || userData.error_description || 'Error al crear usuario' });
    }
    // 2. Crear perfil en tabla profiles
    const profileRes = await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_SERVICE_KEY,
        'Authorization': `Bearer ${SB_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: userData.id,
        email,
        nombre,
        rol: rol || 'operador',
        pais_id: pais_id || null,
        activo: true
      })
    });
    if (!profileRes.ok) {
      const profileErr = await profileRes.json();
      console.error('Profile error:', profileErr);
    }
    res.json({ success: true, id: userData.id });
  } catch (err) {
    console.error('Error crear usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Todo lo demás → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;
