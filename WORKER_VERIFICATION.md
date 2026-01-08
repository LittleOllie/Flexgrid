# Cloudflare Worker Verification Guide

## 🔍 Quick Verification

### Method 1: Browser Console (Easiest)

1. Open Flex Grid in browser
2. Open browser console (F12)
3. Copy and paste this:

```javascript
const WORKER_URL = "https://loflexgrid.littleollienft.workers.dev/img?url=";
const testUrl = WORKER_URL + encodeURIComponent("https://via.placeholder.com/150");

fetch(testUrl)
  .then(res => {
    console.log("✅ Worker Status:", res.status);
    console.log("✅ Content-Type:", res.headers.get('content-type'));
    console.log("✅ CORS:", res.headers.get('access-control-allow-origin'));
    return res.ok ? "✅ Worker is working!" : "❌ Worker returned error";
  })
  .then(console.log)
  .catch(err => console.error("❌ Worker error:", err));
```

### Method 2: Direct URL Test

Open this URL in your browser:
```
https://loflexgrid.littleollienft.workers.dev/img?url=https://via.placeholder.com/150
```

**Expected:** You should see a placeholder image (150x150 gray square)

**If you see:**
- ✅ Image → Worker is working
- ❌ 404/Error → Worker may be down or URL incorrect
- ❌ CORS error → Worker CORS headers need fixing

### Method 3: Using Verification Script

1. Open `verify-worker.js` in browser console
2. Or run: `node verify-worker.js` (if you have Node.js)
3. Follow the test results

---

## 📋 Verification Checklist

### Basic Functionality
- [ ] Worker URL is accessible (not 404)
- [ ] Worker responds to requests
- [ ] Worker returns images (not errors)

### CORS Headers
- [ ] `Access-Control-Allow-Origin` header present
- [ ] Header allows your domain (or `*`)
- [ ] No CORS errors in browser console

### Image Proxying
- [ ] HTTPS images work
- [ ] IPFS images work (or handled gracefully)
- [ ] Alchemy CDN images work
- [ ] Response time is reasonable (< 5 seconds)

### Error Handling
- [ ] Invalid URLs return proper errors
- [ ] Timeout handling works
- [ ] Error messages are clear

---

## 🔧 Current Worker Configuration

**Worker URL:**
```
https://loflexgrid.littleollienft.workers.dev/img?url=
```

**Expected Behavior:**
1. Accepts image URL as query parameter
2. Proxies the image request
3. Returns image with proper CORS headers
4. Handles IPFS URLs (converts to gateway)
5. Handles HTTPS URLs directly

---

## 🧪 Test Cases

### Test 1: Simple HTTPS Image
```javascript
const url = "https://loflexgrid.littleollienft.workers.dev/img?url=" + 
            encodeURIComponent("https://via.placeholder.com/150");
fetch(url).then(res => console.log("Status:", res.status));
```

### Test 2: IPFS Image
```javascript
const url = "https://loflexgrid.littleollienft.workers.dev/img?url=" + 
            encodeURIComponent("ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEy79qvW3pJgK");
fetch(url).then(res => console.log("Status:", res.status));
```

### Test 3: Alchemy CDN Image
```javascript
const url = "https://loflexgrid.littleollienft.workers.dev/img?url=" + 
            encodeURIComponent("https://nft-cdn.alchemy.com/eth-mainnet/abc123/image.png");
fetch(url).then(res => console.log("Status:", res.status));
```

---

## 🚨 Common Issues

### Issue: Worker Returns 404

**Possible Causes:**
- Worker not deployed
- Worker URL incorrect
- Worker was deleted

**Solution:**
- Check Cloudflare dashboard
- Verify worker is deployed
- Check worker name matches URL

### Issue: CORS Errors

**Error:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution:**
- Worker needs to return `Access-Control-Allow-Origin` header
- Update worker code to include CORS headers
- Or configure CORS in Cloudflare dashboard

### Issue: Images Don't Load

**Possible Causes:**
- Worker is slow/timing out
- Worker has errors
- Source images are broken

**Solution:**
- Check worker logs in Cloudflare dashboard
- Test worker directly (see Method 2 above)
- Check source image URLs

### Issue: Worker Timeout

**Error:** Request takes too long (> 30 seconds)

**Solution:**
- Worker may be overloaded
- Source images may be slow
- Consider increasing timeout or optimizing worker

---

## 📊 Expected Response Times

- **Fast:** < 1 second
- **Acceptable:** 1-3 seconds
- **Slow:** 3-5 seconds (may affect UX)
- **Too Slow:** > 5 seconds (needs optimization)

---

## 🔍 Debugging Steps

1. **Check Worker Status**
   ```bash
   curl -I "https://loflexgrid.littleollienft.workers.dev/img?url=https://via.placeholder.com/150"
   ```

2. **Check Response Headers**
   ```bash
   curl -v "https://loflexgrid.littleollienft.workers.dev/img?url=https://via.placeholder.com/150" 2>&1 | grep -i cors
   ```

3. **Test in Browser**
   - Open Network tab in DevTools
   - Load Flex Grid
   - Check worker requests
   - Look for errors or slow responses

4. **Check Cloudflare Dashboard**
   - Log into Cloudflare
   - Go to Workers & Pages
   - Check worker logs
   - Look for errors

---

## ✅ Verification Results Template

After testing, document results:

```
Worker URL: https://loflexgrid.littleollienft.workers.dev/img?url=
Test Date: [Date]
Status: ✅ Working / ⚠️ Issues / ❌ Not Working

Tests:
- Accessibility: ✅ / ❌
- CORS Headers: ✅ / ❌
- HTTPS Images: ✅ / ❌
- IPFS Images: ✅ / ❌
- Response Time: [X]ms

Issues Found:
- [List any issues]

Notes:
- [Any additional notes]
```

---

## 🆘 If Worker is Not Working

### Temporary Workaround

The code has fallback to direct URLs, but this may cause CORS issues:

1. Worker proxy fails
2. Falls back to direct URL
3. May work if source allows CORS
4. May fail with CORS error

### Permanent Solution

1. **Fix Worker** (recommended)
   - Check Cloudflare dashboard
   - Review worker code
   - Fix any errors
   - Redeploy if needed

2. **Alternative Worker**
   - Create new Cloudflare Worker
   - Update URL in config
   - Test thoroughly

3. **Backend Proxy**
   - Use backend server instead
   - Proxy images server-side
   - Update code to use backend

---

**Last Updated:** Phase 2 Implementation  
**Status:** Ready for verification

