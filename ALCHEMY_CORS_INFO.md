# Alchemy API CORS Configuration

## ❓ Do You Need to Add localhost:8000 to Alchemy?

### Short Answer: **YES** ✅ (If origin restrictions are enabled)

**Update:** Your API key has origin restrictions enabled! You need to whitelist localhost:8000.

**Original Answer (for unrestricted keys):**
Alchemy API typically does **NOT** require CORS whitelisting, BUT if your API key has origin restrictions enabled (which yours does), you need to whitelist your domain.

---

## 🔍 How Alchemy API Works

### API Key Authentication (Not CORS)
- Alchemy uses **API keys** for authentication, not CORS restrictions
- The API key is sent in the URL: `https://eth-mainnet.g.alchemy.com/nft/v3/YOUR_KEY/getNFTs`
- Alchemy allows requests from **any origin** as long as you have a valid API key

### CORS Headers
- Alchemy API servers return `Access-Control-Allow-Origin: *` by default
- This means any domain can make requests (including localhost:8000)
- No configuration needed on Alchemy's side

---

## ✅ Your Current Setup

### CSP Configuration
Your `index.html` already allows Alchemy connections:
```html
connect-src
  'self'
  https://*.alchemy.com
```

This is correct and sufficient!

### Code Implementation
Your code makes direct requests to Alchemy:
```javascript
const baseUrl = `https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;
```

This works from any origin, including `localhost:8000`.

---

## 🚨 If You're Seeing CORS Errors

### Possible Causes:

1. **Browser Extension** (Most Likely)
   - Solana wallet extensions can interfere
   - Try disabling browser extensions
   - Use incognito mode to test

2. **Syntax Error** (From Console)
   - `SyntaxError: app.js?v=10:1336 Unexpected end of input`
   - This needs to be fixed first!
   - May be preventing the code from running properly

3. **Network Issues**
   - Check if Alchemy API is accessible
   - Test: `curl https://eth-mainnet.g.alchemy.com/nft/v3/YOUR_KEY/getNFTs?owner=0x...`

---

## 🧪 Testing Alchemy API

### Test Direct API Call
```bash
# Replace YOUR_KEY with your actual API key
curl "https://eth-mainnet.g.alchemy.com/nft/v3/YOUR_KEY/getNFTs?owner=0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd"
```

If this works, Alchemy API is accessible and CORS is not the issue.

### Test from Browser Console
```javascript
// In browser console on localhost:8000
fetch('https://eth-mainnet.g.alchemy.com/nft/v3/YOUR_KEY/getNFTs?owner=0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

If this works, CORS is fine!

---

## 🔧 What to Check Instead

### 1. Fix Syntax Error First
The console shows: `SyntaxError: app.js?v=10:1336 Unexpected end of input`

This is more critical than CORS. Check line 1336 in `app.js`.

### 2. Verify API Key
- Make sure API key is loaded correctly
- Check browser console for config loading
- Verify backend is returning the key

### 3. Check Network Tab
- Open DevTools → Network tab
- Try loading wallets
- Look for failed requests to Alchemy
- Check response headers for CORS errors

---

## 📝 Alchemy Dashboard Settings

### If You Want Extra Security (Optional)

While not required, you can optionally configure:

1. **API Key Restrictions** (Recommended for Production)
   - Go to Alchemy Dashboard
   - Select your API key
   - Add domain restrictions (for production domain only)
   - **Don't restrict for localhost** - keep it open for development

2. **Rate Limits**
   - Check your rate limit settings
   - Free tier: 300 compute units per second
   - Upgrade if needed

---

## ✅ Summary

**Do you need to add localhost:8000 to Alchemy?**
- **YES** ✅ - Your API key has origin restrictions enabled
- Error: "Unspecified origin not on whitelist"
- **Solution:** Add `http://localhost:8000` to Alchemy Dashboard → API Key → Origin Restrictions
- See `ALCHEMY_ORIGIN_WHITELIST.md` for detailed steps

**What to focus on:**
1. ✅ Fix the syntax error in `app.js` (line 1336)
2. ✅ Verify API key is loading correctly
3. ✅ Check browser console for actual errors
4. ✅ Test API calls directly

---

**Status:** No Alchemy CORS configuration needed! ✅

