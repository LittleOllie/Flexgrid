# Alchemy API Connection Test

## 🧪 Test Results

### Test 1: Basic API Call (Command Line)
```bash
curl "https://eth-mainnet.g.alchemy.com/nft/v3/{API_KEY}/getNFTs?owner={wallet}"
```

**Result:** See test output below

### Test 2: With Origin Header (Simulating Browser)
```bash
curl -H "Origin: http://localhost:8000" "https://eth-mainnet.g.alchemy.com/nft/v3/{API_KEY}/getNFTs?owner={wallet}"
```

**Result:** See test output below

---

## ✅ Expected Response

**Success Response:**
```json
{
  "ownedNfts": [
    {
      "contract": {...},
      "tokenId": "...",
      "name": "...",
      "image": {...}
    }
  ],
  "totalCount": 123,
  "pageKey": "..."
}
```

**Error Response:**
```json
{
  "error": "Unspecified origin not on whitelist"
}
```

---

## 🔍 How to Test in Browser

### Method 1: Browser Console Test

1. Open Flex Grid: `http://localhost:8000/flex-grid/index.html`
2. Open Browser Console (F12)
3. Run this test:

```javascript
// Test Alchemy API connection
const apiKey = 'GYuepn7j7XCslBzxLwO5M';
const wallet = '0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd';
const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTs?owner=${wallet}`;

fetch(url)
  .then(res => {
    console.log('Status:', res.status);
    console.log('Headers:', res.headers.get('access-control-allow-origin'));
    return res.json();
  })
  .then(data => {
    if (data.ownedNfts) {
      console.log('✅ SUCCESS!');
      console.log('NFTs found:', data.ownedNfts.length);
      console.log('Total count:', data.totalCount);
      console.log('First NFT:', data.ownedNfts[0]);
    } else {
      console.error('❌ ERROR:', data);
    }
  })
  .catch(err => {
    console.error('❌ FETCH ERROR:', err);
  });
```

### Method 2: Test Through Flex Grid UI

1. Add wallet: `0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd`
2. Click "🔍 Load wallet(s)"
3. Watch for:
   - Status updates
   - Collections list appearing
   - Any error messages

---

## 🚨 Common Issues

### Issue: "Unspecified origin not on whitelist"
**Cause:** Origin not whitelisted in Alchemy
**Solution:** ✅ Already fixed - localhost:8000 is whitelisted

### Issue: "Must be authenticated"
**Cause:** Invalid API key
**Solution:** Check API key is correct

### Issue: CORS Error
**Cause:** Browser blocking request
**Solution:** Check Alchemy returns CORS headers

### Issue: No NFTs Found
**Cause:** Wallet has no NFTs on that chain
**Solution:** Try different wallet or chain

---

## 📊 Test Checklist

- [ ] API key is valid
- [ ] Origin is whitelisted (localhost:8000)
- [ ] API returns data (not error)
- [ ] CORS headers present
- [ ] Browser can make requests
- [ ] Flex Grid can load NFTs

---

**Status:** Ready to test! Run the browser console test above.

