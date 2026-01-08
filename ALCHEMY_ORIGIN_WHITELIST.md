# Alchemy API Origin Whitelist Setup

## 🚨 Issue Found

**Error:** `Unspecified origin not on whitelist.`

**Cause:** Your Alchemy API key has origin restrictions enabled, and `localhost:8000` is not whitelisted.

---

## ✅ Solution: Add localhost:8000 to Alchemy

### Step 1: Log into Alchemy Dashboard

1. Go to: https://dashboard.alchemy.com
2. Sign in to your account
3. Navigate to your API keys

### Step 2: Find Your API Key

1. Go to **"Apps"** or **"API Keys"** section
2. Find the key: `GYuepn7j7XCslBzxLwO5M`
3. Click on it to edit settings

### Step 3: Configure Origin Restrictions

**Option A: Add localhost:8000 (Development)**

1. Find **"Origin Restrictions"** or **"Allowed Origins"** setting
2. Add: `http://localhost:8000`
3. Also add: `http://127.0.0.1:8000` (alternative localhost)
4. Save changes

**Option B: Allow All Origins (Easier for Development)**

1. Find **"Origin Restrictions"** setting
2. Select **"Allow all origins"** or **"No restrictions"**
3. Save changes

**Option C: Remove Restrictions Temporarily**

1. Disable origin restrictions for development
2. Re-enable for production with your production domain

---

## 🎯 Recommended Setup

### Development
- **Allow:** `http://localhost:8000`
- **Allow:** `http://127.0.0.1:8000`
- **Or:** Disable restrictions for development

### Production
- **Allow:** `https://your-production-domain.com`
- **Restrict:** Only your production domain

---

## 🧪 Test After Configuration

After adding localhost:8000, test again:

```bash
# Test from command line (will still fail - needs browser origin)
curl "https://eth-mainnet.g.alchemy.com/nft/v3/GYuepn7j7XCslBzxLwO5M/getNFTs?owner=0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd"
```

**Note:** curl doesn't send an Origin header, so it will still show the error. But it should work from the browser!

### Test from Browser Console

```javascript
// Run this in browser console on localhost:8000
fetch('https://eth-mainnet.g.alchemy.com/nft/v3/GYuepn7j7XCslBzxLwO5M/getNFTs?owner=0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

If this works, the origin is whitelisted correctly!

---

## 🔧 Alternative: Use Backend Proxy

If you can't modify Alchemy settings, you can proxy Alchemy requests through your backend:

### Backend Proxy Endpoint

Add to `backend/server.js`:

```javascript
app.get('/api/alchemy/nfts', async (req, res) => {
  try {
    const { wallet, chain = 'eth' } = req.query;
    const apiKey = process.env.ALCHEMY_API_KEY;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    const host = {
      eth: 'eth-mainnet.g.alchemy.com',
      base: 'base-mainnet.g.alchemy.com',
      polygon: 'polygon-mainnet.g.alchemy.com'
    }[chain];
    
    if (!host) {
      return res.status(400).json({ error: 'Invalid chain' });
    }
    
    const url = `https://${host}/nft/v3/${apiKey}/getNFTs?owner=${wallet}`;
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Alchemy proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

Then update frontend to use backend proxy instead of direct Alchemy calls.

---

## 📝 Summary

**Do you need to add localhost:8000 to Alchemy?**
- **YES** ✅ - Your API key has origin restrictions enabled
- Add `http://localhost:8000` to allowed origins
- Or disable restrictions for development

**Quick Fix:**
1. Alchemy Dashboard → API Keys
2. Edit key: `GYuepn7j7XCslBzxLwO5M`
3. Add `http://localhost:8000` to origin whitelist
4. Save and test!

---

**Status:** Origin whitelist configuration needed in Alchemy Dashboard

