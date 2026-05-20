# FleetOps

Sistema de gestión de flota multi-país.

## Stack
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth)
- **Servidor:** Node.js + Express
- **Deploy:** Vercel

## Deploy en Vercel

### Opción A — Desde GitHub (recomendado)

1. Subí esta carpeta a un repositorio GitHub
2. Andá a [vercel.com](https://vercel.com) → New Project
3. Importá el repositorio
4. Vercel detecta automáticamente la configuración
5. Click en **Deploy**

### Opción B — Desde CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# En la carpeta del proyecto
vercel

# Para producción
vercel --prod
```

## Desarrollo local

```bash
npm install
npm start
# App disponible en http://localhost:3000
```

## Estructura

```
fleetops/
├── public/
│   ├── index.html      # App principal
│   └── manifest.json   # PWA manifest
├── server.js           # Servidor Express
├── package.json
├── vercel.json         # Config Vercel
└── .gitignore
```
