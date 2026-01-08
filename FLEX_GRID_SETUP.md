# Flex Grid Setup Guide
## Secure Configuration Instructions

This guide explains how to securely configure Flex Grid for production.

---

## 🚨 Security Requirements

**CRITICAL:** The Alchemy API key must NEVER be hardcoded in frontend code.

### Current Status
- ⚠️ API key is currently hardcoded in `app.js` (line 23)
- ⚠️ This key is exposed to anyone viewing the source code
- ✅ Secure config system has been implemented
- ⚠️ You need to set up one of the secure methods below

---

## 🔧 Setup Options (Choose One)

### Option 1: Backend Proxy (RECOMMENDED) ⭐

**Best for:** Production deployments with backend infrastructure

#### Steps:

1. **Create Backend Endpoint**
   ```javascript
   // Example: Express.js endpoint
   app.get('/api/config/flex-grid', (req, res) => {
     res.json({
       alchemyApiKey: process.env.ALCHEMY_API_KEY,
       workerUrl: process.env.WORKER_URL
     });
   });
   ```

2. **Store Keys in Environment Variables**
   ```bash
   # .env file (never commit this!)
   ALCHEMY_API_KEY=your_new_rotated_key_here
   WORKER_URL=https://loflexgrid.littleollienft.workers.dev/img?url=
   ```

3. **Rotate API Key**
   - Log into Alchemy dashboard
   - Generate new API key
   - Revoke old key: `GYuepn7j7XCslBzxLwO5M`
   - Configure domain restrictions
   - Update environment variable

4. **Update Code**
   - The code already uses `loadConfig()` function
   - It will automatically load from `/api/config/flex-grid`
   - No code changes needed!

**Pros:**
- ✅ Most secure
- ✅ Keys never exposed to frontend
- ✅ Can add rate limiting
- ✅ Can add authentication

**Cons:**
- ❌ Requires backend infrastructure

---

### Option 2: Environment Variables (Build-Time)

**Best for:** Static site deployments (Vite/Webpack)

#### Steps:

1. **Install Build Tool** (if not already)
   ```bash
   npm install -D vite
   ```

2. **Create `.env` file**
   ```bash
   # .env (never commit this!)
   VITE_ALCHEMY_API_KEY=your_new_rotated_key_here
   VITE_WORKER_URL=https://loflexgrid.littleollienft.workers.dev/img?url=
   ```

3. **Add to `.gitignore`**
   ```
   .env
   .env.local
   .env.*.local
   ```

4. **Build Process**
   - Keys are injected at build time
   - Keys are in the built JavaScript (still visible)
   - But not in source code

5. **Rotate API Key**
   - Generate new key in Alchemy
   - Revoke old key
   - Update `.env` file
   - Rebuild

**Pros:**
- ✅ No backend needed
- ✅ Keys not in source code
- ✅ Works with static hosting

**Cons:**
- ⚠️ Keys still in built JavaScript (visible but not in source)
- ⚠️ Less secure than backend proxy

---

### Option 3: Cloudflare Workers / Vercel Edge Functions

**Best for:** Serverless deployments

#### Steps:

1. **Create Worker Function**
   ```javascript
   // cloudflare-worker.js
   export default {
     async fetch(request) {
       return new Response(JSON.stringify({
         alchemyApiKey: env.ALCHEMY_API_KEY,
         workerUrl: env.WORKER_URL
       }), {
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```

2. **Set Environment Variables**
   - In Cloudflare dashboard
   - Add `ALCHEMY_API_KEY` and `WORKER_URL`
   - Deploy worker

3. **Update Config Loader**
   - Point to your worker URL
   - Update `loadConfig()` function

**Pros:**
- ✅ Serverless (no server to maintain)
- ✅ Scales automatically
- ✅ Fast (edge network)

**Cons:**
- ⚠️ Requires Cloudflare/Vercel account
- ⚠️ Keys still accessible via API (but protected)

---

## 🔑 API Key Rotation Steps

### Alchemy API Key

1. **Log into Alchemy Dashboard**
   - Go to https://dashboard.alchemy.com
   - Navigate to API Keys section

2. **Generate New Key**
   - Click "Create New Key"
   - Name it (e.g., "Flex Grid Production")
   - Copy the new key

3. **Configure Domain Restrictions**
   - In key settings, add your domain(s)
   - Example: `yourdomain.com`, `www.yourdomain.com`
   - This prevents unauthorized use

4. **Update Your Config**
   - Update environment variable or backend config
   - Use the new key

5. **Revoke Old Key**
   - Find key: `GYuepn7j7XCslBzxLwO5M`
   - Click "Revoke" or "Delete"
   - **Important:** Do this AFTER new key is working

6. **Test**
   - Test Flex Grid with new key
   - Verify all functionality works
   - Check Alchemy dashboard for usage

---

## ☁️ Cloudflare Worker Verification

### Current Worker URL
```
https://loflexgrid.littleollienft.workers.dev/img?url=
```

### Verification Steps

1. **Test Worker is Active**
   ```bash
   curl "https://loflexgrid.littleollienft.workers.dev/img?url=https://example.com/image.png"
   ```
   - Should return image or proper error
   - Should not return 404 or connection error

2. **Test with IPFS URL**
   ```bash
   curl "https://loflexgrid.littleollienft.workers.dev/img?url=ipfs://QmExample..."
   ```
   - Should proxy IPFS content
   - Should handle IPFS gateway resolution

3. **Test CORS Headers**
   - Worker should return proper CORS headers
   - Should allow requests from your domain

4. **Check Worker Logs**
   - In Cloudflare dashboard
   - Check for errors
   - Monitor response times

### If Worker is Not Working

1. **Check Worker Status**
   - Log into Cloudflare dashboard
   - Verify worker is deployed
   - Check for errors

2. **Verify Worker Code**
   - Worker should handle:
     - IPFS URLs (`ipfs://...`)
     - HTTPS URLs
     - Proper CORS headers
     - Error handling

3. **Test Alternative**
   - If worker fails, code has fallback to direct URLs
   - But this may cause CORS issues
   - Worker is preferred

---

## 🧪 Testing Your Setup

### Test Checklist

- [ ] Config loads successfully (check browser console)
- [ ] No errors about missing config
- [ ] Alchemy API calls work
- [ ] Images load through worker proxy
- [ ] Export functionality works
- [ ] No API keys visible in browser source

### Test Commands

```javascript
// In browser console, test config loading
import { loadConfig } from './config.js';
const config = await loadConfig();
console.log('Config loaded:', config);
// Should show config object (but NOT the actual key in console)
```

---

## 📋 Production Deployment Checklist

Before deploying to production:

- [ ] API key rotated (new key generated)
- [ ] Old API key revoked
- [ ] Domain restrictions configured in Alchemy
- [ ] Secure config method implemented (Option 1, 2, or 3)
- [ ] Environment variables set (if using Option 2)
- [ ] Backend endpoint created (if using Option 1)
- [ ] Cloudflare Worker verified and working
- [ ] `.env` file added to `.gitignore`
- [ ] No hardcoded keys in source code
- [ ] Tested with new configuration
- [ ] All functionality verified

---

## 🆘 Troubleshooting

### "Configuration not available" Error

**Cause:** Config loader can't find configuration

**Solutions:**
1. Check that your chosen method is set up correctly
2. Verify environment variables are set (if using Option 2)
3. Verify backend endpoint is accessible (if using Option 1)
4. Check browser console for specific error messages

### "Alchemy API error" 

**Cause:** API key is invalid or restricted

**Solutions:**
1. Verify API key is correct
2. Check domain restrictions in Alchemy dashboard
3. Verify key hasn't been revoked
4. Check Alchemy dashboard for rate limits

### Images Not Loading

**Cause:** Worker proxy issue or CORS

**Solutions:**
1. Verify Cloudflare Worker is active
2. Test worker URL directly
3. Check browser console for CORS errors
4. Verify worker returns proper CORS headers

---

## 📞 Support

If you need help:
1. Check browser console for errors
2. Review this setup guide
3. Check Alchemy dashboard for API status
4. Verify Cloudflare Worker logs

---

**Last Updated:** After Phase 1 implementation  
**Status:** Ready for secure configuration setup

