# Flex Grid - NFT Collage Builder

Build beautiful NFT collages from one or multiple crypto wallets and export as PNG.

## 🚀 Quick Start

### Option 1: Static Hosting (Simple)

1. Upload `flex-grid/` folder to your web server
2. Open `index.html` in browser
3. Configure API keys (see Setup below)

### Option 2: With Backend (Recommended)

1. Set up backend server (see `../backend/README.md`)
2. Configure `.env` with API keys
3. Start backend: `npm start`
4. Open `index.html` in browser

## ⚙️ Setup

### Required

1. **Alchemy API Key**
   - Get from: https://dashboard.alchemy.com
   - Add to backend `.env` or config

2. **Backend Server** (recommended)
   - See `../backend/` for setup
   - Provides secure API key management
   - Includes image proxy (replaces Cloudflare Worker)

### Optional

- Cloudflare Worker for image proxy (has DNS issues currently)
- Backend proxy recommended instead

## 📁 Project Structure

```
flex-grid/
├── index.html          # Main UI
├── app.js             # Core logic
├── styles.css         # Styling
├── config.js         # Secure config loader
├── header.png         # Header image
├── logo.png          # Logo
└── README.md         # This file
```

## 🔒 Security

- API keys stored securely (not in frontend)
- Backend proxy for image loading
- CORS protection
- See `FLEX_GRID_SETUP.md` for details

## 🎮 Features

- Multi-wallet support
- Multi-chain (Ethereum, Base)
- Collection filtering
- Custom grid sizes
- Drag & drop reordering
- PNG export with watermark
- Enhanced image loading with retries

## 📚 Documentation

- `FLEX_GRID_SETUP.md` - Complete setup guide
- `PHASE1_COMPLETE.md` - Security implementation
- `PHASE2_COMPLETE.md` - Image loading improvements
- `WORKER_VERIFICATION.md` - Cloudflare Worker info

## 🛠️ Development

### Local Testing

```bash
# Simple server
python -m http.server 8000

# Or with backend
cd ../backend
npm install
npm start
# Backend runs on :3000
```

## 📝 License

UNLICENSED - All rights reserved

## 👥 Credits

Little Ollie Studio

