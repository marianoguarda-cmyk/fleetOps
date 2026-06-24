const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname)));

const SB_URL = 'https://rzmijsyioxtmnfjpezvb.supabase.co';
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const GPS_API_URL = 'https://plataforma.gotdns.org:2302';
const GPS_TOKEN = process.env.GPS_TOKEN || '0fde2a7b8593c641';

const GDRIVE_SA = {
  client_email: "fleetops-drive@operating-braid-496220-b0.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2yejklq3Q9wkT\neG773Pn19xNjXht6lmcRktlnv/ndnLzagDAQamTBMM9biHqiXtHUEwwWK3FmBJdd\nsqLv/ZyiQiDUWri+cpT1O/rXEaAu3Rql1r28tLZiJdYSyQi6wMLtOoxnMkb0KXV/\n6tbPcftIZuDcFBGkMPHXLdt/yoojOHkY1jogLET4/8NhQIVUrpEnklf7HYKiUlet\nPmB66lspHW/NubzZ4LR+ImgKqhqUf4wOF8vTAoK40RbUmLRNS4Sp56+rSS9YEADQ\nOj6quTLkNnSNPmX9fKqRvrRn/TJde1RmU9kEem8dcJ4Up5CERoHWmutWdaksGZgn\nC3pMROTHAgMBAAECggEAO/jyQzHW9LVg0nUUwOlHT/bRcyxYyrdXONJcJ2i69AWt\nhulBG9m0lhhMKIWWavi+Up0vPYTib2z5NuJaCHDG+AvHVrUvYTkZ+35C9laPnmCo\nEhprZWNLZddxLfesuA1vx0MK9v7tfcWuihpEgYqtvhsXEs443Yy7hHTEzGBpQ1WB\nUKEilZOhQqalgKtZ49zcEnSAJzMcme8tLaHadMsBT/YkBb6YqpHZcbDYZffELBsY\nfU+4TTF/6LAR4WG7mtJyUiIEJg4NdzefFfPU2p4K/JAcjoen69533pUd9TLvlHRD\nNvBDEYKHHUpWnDTZa2Yl80I3vTfDx/znIziP/rLKVQKBgQDm/P7uKss1AL++QY0T\nsghm3mqkCC0pMf7/gVhHqRnJxvuR1/eQ1008vIRyg5841PJm0ikaDE+wOj+xkMg1\nuIXi/06grdBWgkbb1y5O9N3PzrZlUzJ6K/mS05z+JoDeiQISYBTJU2SMt0CAe8Ar\nv7pGehUyURZ+1shzzTY1vTyCVQKBgQDKlNH9f4XsjZ5mV1TiDSXIMRxip7vp3vR5\nLphVozd4/sA8Q/uWczVuanh5KHBPUqjcS6zQQWlt0w5lw/iIeuBw8qDvy++65TDF\n5lyd7nUXzDbVLGNo9THH2YC31Fw6BqJAt+VaQlm1hGq0R6YQ7nwDJngOHfHgw/6/\ncxUb5eR+qwKBgQCioTHkAeE8miBmFcT8PvbHZoVypAcX4AmHX0wGeDqd5CkvT/0P\nz2akAp7F+YHbA6L/XaxumIhqrTg3DpbHq/koD1UOsBHlNqgpFGGYWbLqIsIsqNz7\nQ4beJ3t7PSSyiYgZ4+f+r2Y15LfXPknZA45lHINb/9d0ykgrsCogv/GgWQKBgCI8\nrJCvMK8d8BtTvyDFIBGJW0bBGl0YNTEV0uEGSKXGSC7nPmna5rjWfa3cS77cNXWl\nxHsd0vegp9pDGInYWn48Qz7DtKxdd7S6jgSS/G8dMFcuvU5LwjIIbFylI0EbReiy\nK6zpccffrTjysvpBk+vkYH3iSbK27SLmDDc+zzMpAoGAWTt0f0j8JSPukCS4HFDG\nhUABI+womIq9PsMo7V9iVd9QpPcn87QQqzaJ+GqXRRwSP8zNeuk5oPMbg/tyr19G\nMOi6CAz9Q1LNKr2KDL0TFUJPmIhppyqHbbw2pr+pbSnBQarvF4/I+wO/K0jEYA+z\n3Sy7LsscZbs5u0Drrft1b7w=\n-----END PRIVATE KEY-----\n",
  token_uri: "https://oauth2.googleapis.com/token"
};

const GDRIVE_FOLDERS = {
  conductores:   '1HbWvm2uahei85ySU0P3a_c3T0EHCyXa_',
  vehiculos:     '1XP45p-iv3yWFfm8UCEbbd6IEU7IoBidJ',
  checks:        '1ima6LbI3AjrYNcsXcr-jhVsNNq1fqhW7',
  liquidaciones: '1rcawVxbOszv6yFOsI2ln2pmAMCFg3VmY'
};

// Cache token
let _gToken = null, _gTokenExp = 0;

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function getGoogleToken() {
  if (_gToken && Date.now() < _gTokenExp) return _gToken;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg:'RS256', typ:'JWT' })));
  const payload = b64url(Buffer.from(JSON.stringify({
    iss: GDRIVE_SA.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: GDRIVE_SA.token_uri,
    exp: now + 3600,
    iat: now
  })));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = b64url(sign.sign(GDRIVE_SA.private_key));
  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch(GDRIVE_SA.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No token: ' + JSON.stringify(data));
  _gToken = data.access_token;
  _gTokenExp = Date.now() + 3500000;
  return _gToken;
}

// ── GOOGLE DRIVE UPLOAD ───────────────────────────────────────────────────
app.post('/api/drive/upload', async (req, res) => {
  try {
    const { base64, filename, tipo } = req.body;
    if (!base64 || !filename || !tipo) return res.status(400).json({ error: 'Faltan parámetros' });
    const folderId = GDRIVE_FOLDERS[tipo];
    if (!folderId) return res.status(400).json({ error: 'Tipo inválido' });

    const token = await getGoogleToken();
    const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = base64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

    const boundary = 'fleet_boundary_xyz';
    const metadata = JSON.stringify({ name: filename, parents: [folderId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`)
    ]);

    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
          'Content-Length': String(body.length)
        },
        body
      }
    );

    const fileData = await uploadRes.json();
    console.log('Drive upload result:', uploadRes.status, fileData);

    if (!uploadRes.ok) return res.status(500).json({ error: fileData.error?.message || 'Error Drive' });

    // Make public
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });

    const viewUrl = `https://lh3.googleusercontent.com/d/${fileData.id}`;
    res.json({ success: true, id: fileData.id, url: viewUrl });

  } catch (err) {
    console.error('Drive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GPS PROXY ─────────────────────────────────────────────────────────────
app.get('/api/gps/transmissions', async (req, res) => {
  try {
    const response = await fetch(`${GPS_API_URL}/api/seguimiento/transmissions`, {
      headers: { 'Authorization': `Bearer ${GPS_TOKEN}`, 'Accept': 'application/json' }
    });
    const text = await response.text();
    try { res.json(JSON.parse(text)); }
    catch(e) { res.status(500).json({ success: false, data: [], errors: 'Respuesta inválida' }); }
  } catch (err) {
    res.status(500).json({ success: false, data: [], errors: err.message });
  }
});

// ── CAMBIAR CONTRASEÑA (admin cambia la de otro usuario) ──────────────────
app.post('/api/cambiar-password', async (req, res) => {
  const { uid, password } = req.body;
  console.log('cambiar-password called, uid:', uid, 'password length:', password?.length, 'has service key:', !!SB_SERVICE_KEY);
  if (!uid || !password) return res.status(400).json({ error: `Faltan campos: uid=${!!uid} password=${!!password}` });
  if (password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  if (!SB_SERVICE_KEY) return res.status(500).json({ error: 'Service key no configurada en el servidor' });
  try {
    const updateRes = await fetch(`${SB_URL}/auth/v1/admin/users/${uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_SERVICE_KEY,
        'Authorization': `Bearer ${SB_SERVICE_KEY}`
      },
      body: JSON.stringify({ password })
    });
    const data = await updateRes.json();
    console.log('Supabase response:', updateRes.status, JSON.stringify(data).slice(0,200));
    if (!updateRes.ok) return res.status(400).json({ error: data.message || data.msg || JSON.stringify(data) });
    res.json({ success: true });
  } catch (err) {
    console.error('cambiar-password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CREAR USUARIO ─────────────────────────────────────────────────────────
app.post('/api/crear-usuario', async (req, res) => {
  const { email, password, nombre, rol, pais_id } = req.body;
  if (!email || !password || !nombre) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_SERVICE_KEY, 'Authorization': `Bearer ${SB_SERVICE_KEY}` },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nombre, rol, pais_id } })
    });
    const userData = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: userData.message || 'Error al crear usuario' });
    const profileRes = await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_SERVICE_KEY, 'Authorization': `Bearer ${SB_SERVICE_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: userData.id, email, nombre, rol: rol || 'operador', pais_id: pais_id || null, activo: true })
    });
    const profileData = await profileRes.json();
    console.log('Profile insert status:', profileRes.status, JSON.stringify(profileData));
    if (!profileRes.ok) {
      console.error('Profile insert error:', profileData);
      return res.status(500).json({ error: 'Usuario creado en Auth pero error al crear perfil: ' + JSON.stringify(profileData) });
    }
    res.json({ success: true, id: userData.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/operador', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'operador.html'));
});
app.get('/operador.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'operador.html'));
});
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'sw.js'));
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

module.exports = app;
