const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const SB_URL = 'https://rzmijsyioxtmnfjpezvb.supabase.co';
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const GPS_API_URL = 'https://plataforma.gotdns.org:2302'; // Puerto correcto
const GPS_TOKEN = process.env.GPS_TOKEN || '0fde2a7b8593c641';

// ── GPS PROXY (evita CORS) ────────────────────────────────────────────────
app.get('/api/gps/transmissions', async (req, res) => {
  try {
    const url = `${GPS_API_URL}/api/seguimiento/transmissions`;
    console.log('GPS fetch:', url);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GPS_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    const text = await response.text();
    console.log('GPS response status:', response.status);
    console.log('GPS response preview:', text.slice(0, 200));
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch(e) {
      console.error('GPS parse error:', e.message);
      res.status(500).json({ success: false, data: [], errors: 'Respuesta inválida de la API GPS: ' + text.slice(0,100) });
    }
  } catch (err) {
    console.error('GPS API error:', err);
    res.status(500).json({ success: false, data: [], errors: err.message });
  }
});

// ── CREAR USUARIO (Admin API) ────────────────────────────────────────────
app.post('/api/crear-usuario', async (req, res) => {
  const { email, password, nombre, rol, pais_id } = req.body;
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_SERVICE_KEY,
        'Authorization': `Bearer ${SB_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email, password,
        email_confirm: true,
        user_metadata: { nombre, rol, pais_id }
      })
    });
    const userData = await createRes.json();
    if (!createRes.ok) {
      return res.status(400).json({ error: userData.message || userData.error_description || 'Error al crear usuario' });
    }
    const profileRes = await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_SERVICE_KEY,
        'Authorization': `Bearer ${SB_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: userData.id, email, nombre, rol: rol || 'operador', pais_id: pais_id || null, activo: true })
    });
    if (!profileRes.ok) console.error('Profile error:', await profileRes.json());
    res.json({ success: true, id: userData.id });
  } catch (err) {
    console.error('Error crear usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas específicas
app.get('/operador', (req, res) => res.sendFile(path.join(__dirname, 'operador.html')));
app.get('/operador.html', (req, res) => res.sendFile(path.join(__dirname, 'operador.html')));
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// Fallback → index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

module.exports = app;
