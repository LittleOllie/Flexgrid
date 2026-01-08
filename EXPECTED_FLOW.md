# Flex Grid - Expected Flow When Loading Wallets

## 🎯 Complete User Flow

### Step 1: Add Wallet ✅
**Action:** User pastes wallet address and clicks "+ Add wallet"

**What Happens:**
- Wallet address is validated (must be 0x... format, 40 hex chars)
- Wallet is added to `state.wallets` array
- Wallet list is rendered below the input
- Status shows: "Wallet added ✅ (1 total)"

**Expected Result:**
- Wallet appears in the wallet list
- "Load wallet(s)" button becomes enabled

---

### Step 2: Load Wallet(s) 🔍
**Action:** User clicks "🔍 Load wallet(s)" button

**What Happens Behind the Scenes:**

1. **API Call to Alchemy**
   - Calls `fetchAlchemyNFTs()` for each wallet
   - Endpoint: `https://eth-mainnet.g.alchemy.com/nft/v3/{API_KEY}/getNFTsForOwner?owner={wallet}`
   - Fetches up to 800 NFTs per wallet (hard cap)
   - Handles pagination automatically

2. **Data Processing**
   - All NFTs from all wallets are combined
   - Duplicates are removed (same contract + tokenId)
   - NFTs are grouped by collection (contract address)
   - Collections are sorted and counted

3. **UI Updates**
   - Collections list appears below wallet list
   - Each collection shows:
     - Collection name (or contract address if no name)
     - NFT count (e.g., "15 NFTs")
     - Checkbox to select/deselect
   - "Select All" and "Select None" buttons appear
   - Status updates: "Loaded X collection(s) • Y NFT(s)"

**Expected Result:**
- Collections list displays all NFT collections found
- User can see how many NFTs in each collection
- Checkboxes allow selection

---

### Step 3: Select Collections ✅
**Action:** User checks/unchecks collection checkboxes

**What Happens:**
- Selected collections are tracked in `state.selectedKeys`
- "Build grid" button becomes enabled when at least one collection is selected
- Status may update to show selected count

**Expected Result:**
- Selected collections are highlighted/checked
- Build button is ready

---

### Step 4: Build Grid 🧩
**Action:** User clicks "🧩 Build grid" button

**What Happens Behind the Scenes:**

1. **Grid Calculation**
   - Gets selected collections
   - Mixes or flattens items based on "Fill Style" setting
   - Calculates grid dimensions (auto or custom)
   - Caps at 400 NFTs maximum

2. **Grid Creation**
   - Creates tile elements for each NFT
   - Creates filler tiles for empty slots
   - Sets up drag & drop (desktop only)

3. **Image Loading (Enhanced - Phase 2)**
   - **Progress Tracking:** Shows "Loading images: X/Y (Z%)"
   - **Timeout Handling:** 10s for proxy, 8s for direct URLs
   - **Fallback Chain:**
     1. Worker/backend proxy (primary)
     2. Direct URL (if HTTPS)
     3. Alchemy metadata fallback
     4. Alternative IPFS gateways
     5. Mark as missing
   - **Retry Logic:** Automatic retry with exponential backoff
   - **Real-time Updates:** Progress updates as images load

4. **UI Updates**
   - Grid appears with tiles
   - Images load progressively
   - Progress indicator shows loading status
   - Failed images show "Missing" placeholder
   - Watermark appears on first tile

**Expected Result:**
- Grid displays with NFT images
- Progress shows loading status
- Some images may show "Missing" if they fail to load
- User can drag tiles to reorder (desktop)

---

### Step 5: Export PNG 📸
**Action:** User clicks "📸 Export PNG" button

**What Happens:**

1. **Canvas Creation**
   - Creates canvas element
   - Sets dimensions based on grid size
   - Draws background

2. **Image Rendering**
   - Loads each image (with proxy to avoid CORS)
   - Draws images to canvas
   - Draws "Missing" placeholders for failed images
   - Draws watermark

3. **Download**
   - Converts canvas to blob
   - Creates download link
   - Triggers download
   - Filename: `flex-grid-{timestamp}.png`

**Expected Result:**
- PNG file downloads to user's computer
- Image contains all selected NFTs in grid layout
- Watermark included

---

## ⚠️ Potential Issues & Solutions

### Issue: "Configuration Error" Message
**Cause:** Backend not running or config not loading
**Solution:**
- Make sure backend is running: `cd backend && npm run dev`
- Check `http://localhost:3000/health`
- Hard refresh browser

### Issue: "Origin not on whitelist" Error
**Cause:** Alchemy API key has origin restrictions
**Solution:**
- Add `localhost:8000` to Alchemy allowlist (already done ✅)
- Wait 2-5 minutes for propagation

### Issue: No Collections Appear
**Possible Causes:**
- Wallet has no NFTs
- API call failed (check console)
- Network error
- Alchemy API key invalid

**Solution:**
- Check browser console for errors
- Verify wallet has NFTs on that chain
- Test API key: `curl "https://eth-mainnet.g.alchemy.com/nft/v3/{KEY}/getNFTs?owner={wallet}"`

### Issue: Images Don't Load
**Possible Causes:**
- Backend proxy not working
- CORS issues
- Image URLs broken
- Network timeout

**Solution:**
- Check backend is running
- Use "Retry missing" button
- Check browser console for errors
- Images will retry automatically

### Issue: Grid is Empty
**Possible Causes:**
- No collections selected
- All NFTs filtered out
- Grid calculation error

**Solution:**
- Make sure at least one collection is checked
- Check status message for errors

---

## 📊 Expected Performance

### Loading Times (Approximate)
- **Add Wallet:** Instant (< 100ms)
- **Load Wallets:** 2-10 seconds (depends on NFT count)
- **Build Grid:** 1-3 seconds (grid creation)
- **Image Loading:** 5-30 seconds (depends on image count and network)
- **Export PNG:** 3-10 seconds (depends on grid size)

### Success Rates
- **Wallet Loading:** ~95% (if API key valid, wallet has NFTs)
- **Image Loading:** ~90-95% (with enhanced retry logic)
- **Export:** ~99% (if grid built successfully)

---

## ✅ Success Indicators

**When Everything Works:**
1. ✅ Wallet added to list
2. ✅ "Load wallet(s)" button works
3. ✅ Collections appear after loading
4. ✅ Grid builds with images
5. ✅ Progress indicator shows loading
6. ✅ Export creates PNG file

**Status Messages to Expect:**
- "Wallet added ✅"
- "Loading wallet(s)…"
- "Loaded X collection(s) • Y NFT(s)"
- "Grid built ✅"
- "Loading images: X/Y (Z%)"
- "Ready ✅"

---

## 🎮 Next Steps After Loading

Once wallets are loaded and grid is built:

1. **Reorder Tiles** (Desktop)
   - Drag and drop tiles to reorder
   - Grid updates in real-time

2. **Retry Missing Images**
   - Click "🔄 Retry missing" button
   - Failed images will retry with enhanced logic

3. **Change Settings**
   - Switch chains (requires reload)
   - Change grid size
   - Change fill style

4. **Export**
   - Click "📸 Export PNG"
   - Download your collage!

---

**Status:** Ready to test! Load a wallet and watch the magic happen! 🚀

