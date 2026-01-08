# Connection Indicator - When It Appears

## 🟢 Green "Connected" Indicator

### When It Shows:
The green indicator **only appears** after you successfully load wallets.

**Steps:**
1. Add wallet address
2. Click "🔍 Load wallet(s)"
3. Wait for NFTs to load
4. **Green indicator appears** when loading completes successfully

### When It Hides:
- Initially hidden (not connected yet)
- Hides on errors
- Hides when config fails to load

---

## 🧪 Test It

1. **Refresh browser** (hard refresh: `Cmd+Shift+R`)
2. **Add wallet:** `0x4d127eaba5b8288f7c8c3d0eb42b43cd35ac9ddd`
3. **Click "🔍 Load wallet(s)"**
4. **Wait for:** "Loaded X wallet(s) ✅ Found Y collections"
5. **Green indicator should appear!**

---

## 🔍 Troubleshooting

### Green indicator not showing?

**Check:**
1. Did wallets load successfully? (Check status message)
2. Any errors in console? (F12 → Console tab)
3. Did you click "Load wallet(s)" button?
4. Is backend running? (`localhost:3000`)

**If wallets loaded but no green indicator:**
- Check browser console for JavaScript errors
- Verify `showConnectionStatus(true)` is being called
- Check if `connectionStatus` element exists in HTML

---

## 📍 Location

The green indicator appears:
- **Above the status message**
- **Left side of the status bar**
- **Green pulsing dot + "Connected" text**

---

**Note:** The indicator only shows **after** wallets are loaded, not just when you add them to the list.

