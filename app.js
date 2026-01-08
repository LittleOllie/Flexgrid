console.log("✅ NEW app.js RUNNING v9999");
alert("NEW app.js running v9999");


/* Little Ollie Flex Grid (SAFE export for file:// + Multi-Wallet)
   - GRID loads via Worker proxy + IPFS gateway fallback
   - Guards against DOUBLE-PROXY
   - Alchemy metadata fallback per token after image failures
   - IMPORTANT:
     - Grid display can fall back to DIRECT urls (for reliability) if Worker fails.
     - Export stays PROXY-first to keep canvas untainted.
   - SECURITY: API keys loaded from secure config (see config.js)
*/

const $ = (id) => document.getElementById(id);

const state = {
  collections: [],
  selectedKeys: new Set(),
  wallets: [],
  chain: "eth",
  host: "eth-mainnet.g.alchemy.com",
};

// Configuration (loaded securely - see loadConfig() below)
let ALCHEMY_KEY = null;
let IMG_PROXY = null;
let configLoaded = false;

const ALCHEMY_HOST = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  apechain: null,
};

// ---------- Build cache-buster (GRID only) ----------
let BUILD_ID = Date.now();

// ---------- Image load limiter (prevents Worker/IPFS stampede) ----------
function createLimiter(max = 3) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;

    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

// 3–5 is generally safe. If your Worker gets 502s, keep it low (3).
let gridImgLimit = createLimiter(3);

// ---- Image loading tuning ----
const TILE_TOTAL_BUDGET_MS = 28000;     // total time allowed per tile before "Missing"
const PROXY_TIMEOUT_MS = 12000;         // per attempt
const DIRECT_TIMEOUT_MS = 10000;        // per attempt
const MAX_TILE_PASSES = 2;              // number of full passes over strategies (not per-gateway)

// ---------- Timeout wrapper for image loading ----------
function loadImgWithTimeout(imgEl, src, timeout = 10000) {
  return Promise.race([
    new Promise((resolve, reject) => {
      const clean = () => {
        imgEl.onload = null;
        imgEl.onerror = null;
      };
      imgEl.onload = () => {
        clean();
        resolve(true);
      };
      imgEl.onerror = () => {
        clean();
        reject(new Error("Image failed: " + src));
      };
      imgEl.src = "";
      imgEl.src = src;
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Image load timeout")), timeout)
    )
  ]);
}

function loadImgWithLimiter(imgEl, src, timeout = 10000) {
  return gridImgLimit(() => loadImgWithTimeout(imgEl, src, timeout));
}

// Non-limited (for direct fallback)
function loadImgNoLimit(imgEl, src, timeout = 8000) {
  return loadImgWithTimeout(imgEl, src, timeout);
}

// ---------- UI helpers ----------
// Error log state
const errorLog = {
  errors: [],
  maxErrors: 50
};

// Add error to log
function addError(error, context = '') {
  const timestamp = new Date().toLocaleTimeString();
  const errorEntry = {
    timestamp,
    message: error?.message || String(error),
    context,
    stack: error?.stack,
    fullError: error
  };

  errorLog.errors.unshift(errorEntry);
  if (errorLog.errors.length > errorLog.maxErrors) {
    errorLog.errors = errorLog.errors.slice(0, errorLog.maxErrors);
  }

  updateErrorLogDisplay();
}

// Update error log display
function updateErrorLogDisplay() {
  const errorLogEl = $("errorLog");
  const errorLogContent = $("errorLogContent");

  if (!errorLogEl || !errorLogContent) return;

  if (errorLog.errors.length === 0) {
    errorLogEl.style.display = 'none';
    return;
  }

  errorLogEl.style.display = 'block';
  errorLogContent.innerHTML = errorLog.errors.map((err) => {
    const contextText = err.context ? ` <span style="opacity: 0.7;">[${err.context}]</span>` : '';
    const stackText = err.stack && window.location.hostname === 'localhost'
      ? `<div style="margin-top: 4px; padding-left: 12px; opacity: 0.6; font-size: 10px;">${err.stack.split('\n').slice(0, 3).join('<br>')}</div>`
      : '';
    return `
      <div style="padding: 6px 0; border-bottom: 1px solid rgba(244, 67, 54, 0.2);">
        <div style="color: #f44336; font-weight: 700;">
          <span style="opacity: 0.7; font-size: 10px;">[${err.timestamp}]</span>${contextText}
        </div>
        <div style="margin-top: 2px; color: #ffcdd2;">${err.message}</div>
        ${stackText}
      </div>
    `;
  }).join('');
}

// Clear error log
function clearErrorLog() {
  errorLog.errors = [];
  updateErrorLogDisplay();
}

// Show connection status (red = not connected, green = connected)
function showConnectionStatus(connected) {
  const statusEl = $("connectionStatus");
  const lightEl = $("connectionLight");
  const textEl = $("connectionText");

  if (!statusEl) return;

  // Always show the indicator
  statusEl.style.display = 'flex';

  if (connected) {
    // Green - Connected
    statusEl.style.background = 'rgba(76, 175, 80, 0.15)';
    statusEl.style.borderColor = 'rgba(76, 175, 80, 0.3)';
    if (lightEl) {
      lightEl.style.background = '#4CAF50';
      lightEl.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.6)';
    }
    if (textEl) {
      textEl.textContent = 'Connected';
      textEl.style.color = '#4CAF50';
    }
  } else {
    // Red - Not Connected
    statusEl.style.background = 'rgba(244, 67, 54, 0.15)';
    statusEl.style.borderColor = 'rgba(244, 67, 54, 0.3)';
    if (lightEl) {
      lightEl.style.background = '#f44336';
      lightEl.style.boxShadow = '0 0 8px rgba(244, 67, 54, 0.6)';
    }
    if (textEl) {
      textEl.textContent = 'Not Connected';
      textEl.style.color = '#f44336';
    }
  }
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function updateImageProgress() {
  const { total, loaded, failed, retrying } = state.imageLoadState;
  if (total === 0) return;

  const progress = Math.round((loaded / total) * 100);
  let statusMsg = `Loading images: ${loaded}/${total} (${progress}%)`;

  if (failed > 0) statusMsg += ` - ${failed} failed`;
  if (retrying > 0) statusMsg += ` - ${retrying} retrying...`;

  setStatus(statusMsg);
}

function showControlsPanel(show) {
  const el = $("controlsPanel");
  if (el) el.style.display = show ? "" : "none";
}

function enableButtons() {
  const loadBtn = $("loadBtn");
  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");

  const hasWallets = state.wallets.length > 0;
  if (loadBtn) loadBtn.disabled = !hasWallets;
  if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;

  // export is enabled only after buildGrid()
  if (exportBtn) exportBtn.disabled = true;
}

function setGridColumns(cols) {
  const grid = $("grid");
  if (grid) grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
}

function safeText(s) {
  return (s || "").toString();
}

// ---------- URL helpers ----------
function isAlreadyProxied(url) {
  return typeof url === "string" && IMG_PROXY && url.startsWith(IMG_PROXY);
}

function getIpfsPath(url) {
  if (!url) return "";
  const s = String(url).trim();

  if (s.startsWith("ipfs://")) {
    let p = s.slice("ipfs://".length);
    p = p.replace(/^ipfs\//, "");
    return p.replace(/^\/+/, "");
  }

  try {
    const u = new URL(s);
    const idx = u.pathname.indexOf("/ipfs/");
    if (idx !== -1) {
      return u.pathname.slice(idx + "/ipfs/".length).replace(/^\/+/, "");
    }
  } catch (e) {}

  return "";
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (isAlreadyProxied(url)) return url;

  const ipfsPath = getIpfsPath(url);
  if (ipfsPath) return "ipfs://" + ipfsPath;

  try {
    const u = new URL(String(url));
    return u.toString();
  } catch (e) {
    return String(url);
  }
}

// ✅ Proxy EVERYTHING, but never twice
function safeProxyUrl(src) {
  if (!src) return "";
  if (!IMG_PROXY) return ""; // config not loaded yet
  if (isAlreadyProxied(src)) return src;

  const direct = normalizeImageUrl(src);
  if (isAlreadyProxied(direct)) return direct;

  return IMG_PROXY + encodeURIComponent(direct);
}

// Toggle this to force refresh when debugging
const GRID_FORCE_REFRESH = false;

// For GRID: proxy-first, cache-buster OPTIONAL
function gridProxyUrl(src) {
  const prox = safeProxyUrl(src);
  if (!prox) return "";
  if (!GRID_FORCE_REFRESH) return prox;
  return prox + (prox.includes("?") ? "&" : "?") + "b=" + BUILD_ID;
}

// For EXPORT: proxy only (avoid canvas taint) — NO cache-buster
function exportProxyUrl(src) {
  return safeProxyUrl(src);
}

// ---------- Watermark helpers (DOM + Export) ----------
function ellipsizeToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ell = "…";
  let t = text;
  while (t.length > 1 && ctx.measureText(t + ell).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + ell;
}

function syncWatermarkDOMToOneTile() {
  const wm = $("wmGrid");
  const grid = $("grid");
  if (!wm || !grid) return;

  const firstTile = grid.querySelector(".tile");
  if (!firstTile) {
    wm.style.display = "none";
    return;
  }

  wm.style.display = "";
  wm.style.whiteSpace = "nowrap";
  wm.style.overflow = "hidden";
  wm.style.textOverflow = "ellipsis";

  const tileW = firstTile.getBoundingClientRect().width || 0;
  wm.style.maxWidth = `${Math.max(80, tileW - 8)}px`;

  const s = Math.max(0.62, Math.min(1, tileW / 260));
  wm.style.transform = `scale(${s})`;
  wm.style.transformOrigin = "top left";
}

// ---------- Wallet list ----------
function normalizeWallet(w) {
  return (w || "").trim().replace(/\s+/g, "").toLowerCase();
}

function addWallet() {
  const input = $("walletInput");
  const w = normalizeWallet(input ? input.value : "");

  if (!w) return setStatus("Paste a wallet address first.");
  if (!/^0x[a-f0-9]{40}$/.test(w)) return setStatus("That doesn’t look like a valid 0x wallet address.");
  if (state.wallets.includes(w)) return setStatus("That wallet is already added.");

  state.wallets.push(w);

  if (input) {
    input.value = "";
    input.blur();
  }

  renderWalletList();
  enableButtons();
  setStatus(`Wallet added ✅ (${state.wallets.length} total)`);
}

function removeWallet(w) {
  state.wallets = state.wallets.filter((x) => x !== w);
  renderWalletList();
  enableButtons();
  setStatus(`Wallet removed ✅ (${state.wallets.length} remaining)`);
}

function renderWalletList() {
  const wrap = $("walletList");
  if (!wrap) return;

  if (!state.wallets.length) {
    wrap.style.display = "none";
    wrap.innerHTML = "";
    return;
  }

  wrap.style.display = "";
  wrap.innerHTML = "";

  state.wallets.forEach((w) => {
    const row = document.createElement("div");
    row.className = "walletChip";

    const left = document.createElement("div");
    left.style.minWidth = "0";

    const addr = document.createElement("div");
    addr.className = "walletAddr";
    addr.textContent = w;

    const meta = document.createElement("div");
    meta.className = "walletMeta";
    meta.textContent = "Ready to load";

    left.appendChild(addr);
    left.appendChild(meta);

    const btns = document.createElement("div");
    btns.className = "chipBtns";

    const rm = document.createElement("button");
    rm.className = "btnSmall";
    rm.type = "button";
    rm.textContent = "🗑 Remove";
    rm.addEventListener("click", () => removeWallet(w));

    btns.appendChild(rm);

    row.appendChild(left);
    row.appendChild(btns);
    wrap.appendChild(row);
  });
}

// ---------- Collections ----------
function renderCollectionsList() {
  const wrap = $("collectionsList");
  if (!wrap) return;

  wrap.innerHTML = "";

  state.collections.forEach((c) => {
    const row = document.createElement("div");
    row.className = "collectionItem";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedKeys.has(c.key);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedKeys.add(c.key);
      else state.selectedKeys.delete(c.key);

      const buildBtn = $("buildBtn");
      const exportBtn = $("exportBtn");
      if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
      if (exportBtn) exportBtn.disabled = true;
    });

    const label = document.createElement("div");
    label.style.minWidth = "0";

    const name = document.createElement("div");
    name.className = "collectionName";
    name.textContent = c.name;

    const count = document.createElement("div");
    count.className = "collectionCount";
    count.textContent = `${c.count} owned`;

    label.appendChild(name);
    label.appendChild(count);

    row.appendChild(checkbox);
    row.appendChild(label);
    wrap.appendChild(row);
  });
}

function setAllCollections(checked) {
  state.selectedKeys.clear();
  if (checked) state.collections.forEach((c) => state.selectedKeys.add(c.key));
  renderCollectionsList();

  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");
  if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
  if (exportBtn) exportBtn.disabled = true;
}

function getSelectedCollections() {
  return state.collections.filter((c) => state.selectedKeys.has(c.key));
}

// ---------- Grid helpers ----------
function flattenItems(chosen) {
  const all = [];
  chosen.forEach((c) => c.items.forEach((it) => all.push({ ...it, sourceKey: c.key })));
  return all;
}

function mixEvenly(chosen) {
  const queues = chosen.map((c) => ({ key: c.key, items: [...c.items] }));
  const out = [];
  let alive = true;

  while (alive) {
    alive = false;
    for (const q of queues) {
      if (q.items.length) {
        alive = true;
        out.push({ ...q.items.shift(), sourceKey: q.key });
      }
    }
  }
  return out;
}

function closestSquareDims(n) {
  const side = Math.max(1, Math.ceil(Math.sqrt(n)));
  return { rows: side, cols: side };
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function getGridChoice() {
  const v = $("gridSize")?.value || "auto";

  if (v === "custom") {
    const cols = clampInt($("customCols")?.value, 2, 50, 6);
    const rows = clampInt($("customRows")?.value, 2, 50, 6);
    const cap = rows * cols;
    return { mode: "fixed", cap, rows, cols };
  }

  if (v === "auto") return { mode: "auto" };

  const cap = Math.max(1, Number(v));
  const side = Math.round(Math.sqrt(cap));
  return { mode: "fixed", cap, rows: side, cols: side };
}

// ---------- Build grid ----------
function buildGrid() {
  // ✅ reset limiter each build (prevents queue clog after many grids)
  gridImgLimit = createLimiter(3);

  // ✅ Only update BUILD_ID when forcing refresh
  if (GRID_FORCE_REFRESH) BUILD_ID = Date.now();

  // Initialize image loading state tracking
  state.imageLoadState = {
    total: 0,
    loaded: 0,
    failed: 0,
    retrying: 0
  };

  const chosen = getSelectedCollections();
  const exportBtn = $("exportBtn");

  if (!chosen.length) {
    setStatus("Select at least one collection.");
    if (exportBtn) exportBtn.disabled = true;
    return;
  }

  const mixMode = $("mixMode")?.value || "mix";
  let items = mixMode === "mix" ? mixEvenly(chosen) : flattenItems(chosen);

  const HARD_CAP = 400;
  if (items.length > HARD_CAP) items = items.slice(0, HARD_CAP);

  const choice = getGridChoice();

  let rows, cols, totalSlots, usedItems;

  if (choice.mode === "fixed") {
    rows = choice.rows;
    cols = choice.cols;
    totalSlots = choice.cap;
    usedItems = items.slice(0, totalSlots);
  } else {
    const dims = closestSquareDims(items.length);
    rows = dims.rows;
    cols = dims.cols;
    totalSlots = rows * cols;
    usedItems = items;
  }

  setGridColumns(cols);

  const grid = $("grid");
  if (!grid) return;
  grid.innerHTML = "";

  const stageTitle = $("stageTitle");
  const stageMeta = $("stageMeta");
  if (stageTitle) stageTitle.textContent = "Little Ollie Flex Grid";
  if (stageMeta) {
    stageMeta.textContent = `${state.wallets.length} wallet(s) • ${chosen.length} collection(s) • ${usedItems.length} NFT(s) • grid ${rows}×${cols}`;
  }

  // Count total images to load (only NFTs with images)
  const nftsWithImages = usedItems.filter(item => item?.image);
  state.imageLoadState.total = nftsWithImages.length;

  for (let i = 0; i < usedItems.length; i++) grid.appendChild(makeNFTTile(usedItems[i]));
  const remaining = totalSlots - usedItems.length;
  for (let j = 0; j < remaining; j++) grid.appendChild(makeFillerTile());

  const wm = $("wmGrid");
  if (wm) wm.style.display = "";
  syncWatermarkDOMToOneTile();

  if (exportBtn) exportBtn.disabled = false;

  // Show initial progress
  if (state.imageLoadState.total > 0) {
    updateImageProgress();
  } else {
    setStatus("Grid built ✅ (drag tiles to reorder on desktop)");
  }

  enableDragDrop();
}

// ---------- Image loading + fallbacks ----------
function makeMissingInner() {
  const d = document.createElement("div");
  d.className = "fillerText";
  d.textContent = "Missing";
  d.style.fontSize = "16px";
  d.style.opacity = "0.92";
  return d;
}

function makeFillerInner() {
  const d = document.createElement("div");
  d.className = "fillerText";
  d.textContent = "LO ⚡";
  return d;
}

function markMissing(tile, img, rawUrl) {
  try { if (img && img.parentNode) img.remove(); } catch (e) {}
  tile.dataset.kind = "missing";

  const src = tile.dataset.src || "";
  if (!tile.querySelector(".fillerText")) tile.appendChild(makeMissingInner());

  // Log missing tile only in development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.warn("❌ Tile missing", {
      contract: tile.dataset.contract,
      tokenId: tile.dataset.tokenId,
      src,
      rawUrl,
      ipfsPath: tile.dataset.ipfsPath
    });
  }
}

async function fetchBestAlchemyImage({ contract, tokenId, host }) {
  const meta = await fetchAlchemyNFTMetadata({ contract, tokenId, host });

  const image =
    meta?.image?.cachedUrl ||
    meta?.image?.pngUrl ||
    meta?.image?.thumbnailUrl ||
    meta?.image?.originalUrl ||
    meta?.rawMetadata?.image ||
    "";

  return image ? normalizeImageUrl(image) : "";
}

// GRID loading strategy:
// A) Alchemy cachedUrl (proxy then direct) once
// B) Worker proxy (primary)
// C) Direct non-IPFS https
// D) Alt IPFS gateways (proxy then direct)
// E) Retry passes (MAX_TILE_PASSES)
// F) Missing
async function loadTileImage(tile, img, rawUrl, pass = 0) {
  const contract = tile.dataset.contract || "";
  const tokenId = tile.dataset.tokenId || "";
  const start = Number(tile.dataset.loadStart || "0") || Date.now();
  if (!tile.dataset.loadStart) tile.dataset.loadStart = String(start);

  const deadline = start + TILE_TOTAL_BUDGET_MS;

  const ipfsPath = getIpfsPath(rawUrl);
  tile.dataset.ipfsPath = ipfsPath || "";

  const directNormalized = normalizeImageUrl(rawUrl);
  if (!directNormalized) {
    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();
    return false;
  }

  const primary = ipfsPath ? ("ipfs://" + ipfsPath) : directNormalized;
  tile.dataset.src = primary;

  const timeLeft = () => deadline - Date.now();
  const stillHaveTime = (min = 500) => timeLeft() > min;

  async function tryLoad(fn) {
    if (!stillHaveTime()) return false;
    try {
      await fn();
      state.imageLoadState.loaded++;
      tile.dataset.kind = "loaded";
      updateImageProgress();
      return true;
    } catch {
      return false;
    }
  }

  if (pass > 0) {
    const backoff = Math.min(800 * Math.pow(1.6, pass - 1), 3500);
    await new Promise(r => setTimeout(r, backoff));
  }

  // A) Alchemy cached URL once
  if (contract && tokenId && tile.dataset.alchemyTried !== "1") {
    tile.dataset.alchemyTried = "1";
    try {
      const metaUrl = await fetchBestAlchemyImage({ contract, tokenId, host: state.host });
      if (metaUrl && metaUrl !== primary) {
        const ok1 = await tryLoad(() =>
          loadImgWithLimiter(
            img,
            gridProxyUrl(metaUrl),
            Math.min(PROXY_TIMEOUT_MS, Math.max(4000, timeLeft()))
          )
        );
        if (ok1) { tile.dataset.src = metaUrl; return true; }

        if (/^https?:\/\//i.test(metaUrl)) {
          const ok2 = await tryLoad(() =>
            loadImgNoLimit(
              img,
              metaUrl,
              Math.min(DIRECT_TIMEOUT_MS, Math.max(3500, timeLeft()))
            )
          );
          if (ok2) { tile.dataset.src = metaUrl; return true; }
        }
      }
    } catch {}
  }

  // B) Worker proxy (primary)
  {
    const ok = await tryLoad(() =>
      loadImgWithLimiter(
        img,
        gridProxyUrl(primary),
        Math.min(PROXY_TIMEOUT_MS, Math.max(4000, timeLeft()))
      )
    );
    if (ok) return true;
  }

  // C) Direct non-IPFS https
  if (!ipfsPath && /^https?:\/\//i.test(primary)) {
    const ok = await tryLoad(() =>
      loadImgNoLimit(
        img,
        primary,
        Math.min(DIRECT_TIMEOUT_MS, Math.max(3500, timeLeft()))
      )
    );
    if (ok) return true;
  }

  // D) Alt gateways for IPFS (proxy then direct)
  if (ipfsPath) {
    const altGateways = [
      `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`,
      `https://w3s.link/ipfs/${ipfsPath}`,
      `https://nftstorage.link/ipfs/${ipfsPath}`,
      `https://dweb.link/ipfs/${ipfsPath}`,
      `https://cf-ipfs.com/ipfs/${ipfsPath}`,
      `https://ipfs.io/ipfs/${ipfsPath}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsPath}`,
    ];

    for (const gw of altGateways) {
      const ok = await tryLoad(() =>
        loadImgWithLimiter(
          img,
          gridProxyUrl(gw),
          Math.min(PROXY_TIMEOUT_MS, Math.max(4000, timeLeft()))
        )
      );
      if (ok) return true;
    }
    for (const gw of altGateways) {
      const ok = await tryLoad(() =>
        loadImgNoLimit(
          img,
          gw,
          Math.min(DIRECT_TIMEOUT_MS, Math.max(3500, timeLeft()))
        )
      );
      if (ok) return true;
    }
  }

  // E) Retry passes
  if (stillHaveTime(1200) && pass + 1 < MAX_TILE_PASSES) {
    return loadTileImage(tile, img, rawUrl, pass + 1);
  }

  // F) Missing
  markMissing(tile, img, rawUrl);
  state.imageLoadState.failed++;
  updateImageProgress();
  addError(new Error(`Failed to load image after budget: ${String(rawUrl).slice(0, 120)}`), "Image Loading");
  return false;
}

function makeNFTTile(it) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.draggable = true;

  const contract = (it?.contract || it?.contractAddress || it?.sourceKey || "").toLowerCase();
  const tokenId = (it?.tokenId || "").toString();
  tile.dataset.contract = contract;
  tile.dataset.tokenId = tokenId;

  const raw = it?.image || "";
  tile.dataset.kind = raw ? "nft" : "empty";
  tile.dataset.alchemyTried = "0";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = safeText(it?.name || "NFT");
  img.referrerPolicy = "no-referrer";
  img.crossOrigin = "anonymous";

  if (raw) {
    tile.appendChild(img);
    tile.dataset.rawUrl = raw;
    tile.dataset.retryCount = "0";
    loadTileImage(tile, img, raw).catch(() => {});
  } else {
    tile.dataset.src = "";
    tile.dataset.kind = "empty";
    tile.appendChild(makeFillerInner());
  }

  return tile;
}

function makeFillerTile() {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.draggable = true;
  tile.dataset.src = "";
  tile.dataset.kind = "empty";
  tile.appendChild(makeFillerInner());
  return tile;
}

// ---------- Drag & drop ----------
function enableDragDrop() {
  const grid = $("grid");
  if (!grid) return;

  const tiles = Array.from(grid.querySelectorAll(".tile"));
  let dragEl = null;

  tiles.forEach((t) => {
    t.addEventListener("dragstart", (e) => {
      dragEl = t;
      t.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "tile");
    });

    t.addEventListener("dragend", () => {
      t.classList.remove("dragging");
      tiles.forEach((x) => x.classList.remove("dropTarget"));
      dragEl = null;
    });

    t.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === t) return;
      t.classList.add("dropTarget");
      e.dataTransfer.dropEffect = "move";
    });

    t.addEventListener("dragleave", () => t.classList.remove("dropTarget"));

    t.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === t) return;

      const a = dragEl;
      const b = t;

      const aNext = a.nextSibling === b ? a : a.nextSibling;
      grid.insertBefore(a, b);
      grid.insertBefore(b, aNext);

      tiles.forEach((x) => x.classList.remove("dropTarget"));
    });
  });
}

// ---------- Wallet load ----------
async function loadWallets() {
  const chain = $("chainSelect")?.value || "eth";

  if (chain === "solana") return setStatus("Solana coming soon. For now use ETH or Base.");
  if (chain === "apechain") return setStatus("ApeChain coming soon. For now use ETH or Base.");

  if (!state.wallets.length) return setStatus("Add at least one wallet first.");

  if (!configLoaded || !ALCHEMY_KEY) {
    return setStatus(
      "⚠️ Configuration not loaded. " +
      "Please set up secure config (see FLEX_GRID_SETUP.md). " +
      "For development, enable DEV_CONFIG in config.js"
    );
  }

  const host = ALCHEMY_HOST[chain];
  if (!host) return setStatus("Chain not configured.");

  state.chain = chain;
  state.host = host;

  try {
    setStatus(`Loading NFTs… (${state.wallets.length} wallet(s))`);

    const allNfts = [];
    for (let i = 0; i < state.wallets.length; i++) {
      const w = state.wallets[i];
      setStatus(`Loading NFTs… wallet ${i + 1}/${state.wallets.length}`);
      const nfts = await fetchAlchemyNFTs({ wallet: w, host });
      allNfts.push(...(nfts || []));
    }

    const deduped = dedupeNFTs(allNfts);
    const grouped = groupByCollection(deduped);

    state.collections = grouped;
    state.selectedKeys = new Set();

    renderCollectionsList();
    showControlsPanel(true);

    const buildBtn = $("buildBtn");
    const exportBtn = $("exportBtn");
    if (buildBtn) buildBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;

    const stageTitle = $("stageTitle");
    const stageMeta = $("stageMeta");
    if (stageTitle) stageTitle.textContent = "Wallets loaded";
    if (stageMeta) stageMeta.textContent = "Select collections, then 🧩 Build grid.";

    setStatus(`Loaded ${state.wallets.length} wallet(s) ✅ Found ${grouped.length} collections`);
    showConnectionStatus(true);
  } catch (err) {
    const errorMsg = err?.message || "Error loading NFTs.";
    setStatus(`❌ ${errorMsg} Please try again or check your wallet addresses.`);
    addError(err, 'Load Wallets');
    showConnectionStatus(false);
  }
}

function dedupeNFTs(nfts) {
  const seen = new Set();
  const out = [];
  for (const nft of nfts) {
    const contract = (nft?.contract?.address || "").toLowerCase();
    const tokenId = (nft?.tokenId || "").toString();
    const key = `${contract}:${tokenId}`;
    if (!contract || !tokenId) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(nft);
  }
  return out;
}

async function fetchAlchemyNFTs({ wallet, host }) {
  const baseUrl = `https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;

  let pageKey = null;
  let all = [];
  const hardCap = 800;

  try {
    while (all.length < hardCap) {
      const url = new URL(baseUrl);
      url.searchParams.set("owner", wallet);
      url.searchParams.set("withMetadata", "true");
      url.searchParams.set("pageSize", "100");
      if (pageKey) url.searchParams.set("pageKey", pageKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Alchemy API error (${res.status}): ${errorText.substring(0, 100)}`);
      }
      const json = await res.json();

      if (json.error) {
        throw new Error(`Alchemy API error: ${json.error.message || JSON.stringify(json.error)}`);
      }

      all.push(...(json.ownedNfts || []));
      if (!json.pageKey) break;
      pageKey = json.pageKey;
    }
  } catch (error) {
    addError(error, `Alchemy API (${wallet.substring(0, 8)}...)`);
    throw error;
  }

  return all;
}

async function fetchAlchemyNFTMetadata({ contract, tokenId, host }) {
  try {
    const url = new URL(`https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTMetadata`);
    url.searchParams.set("contractAddress", contract);
    url.searchParams.set("tokenId", tokenId);
    url.searchParams.set("refreshCache", "false");

    const res = await fetch(url.toString());
    if (!res.ok) {
      addError(new Error(`Alchemy metadata fetch failed: ${res.status}`), `Metadata (${contract.substring(0, 8)}...)`);
      throw new Error(`Alchemy metadata error (${res.status})`);
    }
    const json = await res.json();

    if (json.error) {
      addError(new Error(`Alchemy metadata error: ${json.error.message || JSON.stringify(json.error)}`), `Metadata (${contract.substring(0, 8)}...)`);
      throw new Error(`Alchemy metadata error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    return json;
  } catch (error) {
    if (!error.message.includes('Alchemy metadata')) {
      addError(error, `Metadata Fetch (${contract.substring(0, 8)}...)`);
    }
    throw error;
  }
}

function groupByCollection(nfts) {
  const map = new Map();

  for (const nft of nfts) {
    const contract = (nft?.contract?.address || "unknown").toLowerCase();
    const colName = nft?.contract?.name || nft?.collection?.name || "Unknown Collection";

    const tokenId = (nft?.tokenId || "").toString();
    const name = nft?.name || (tokenId ? `#${tokenId}` : "NFT");

    const image =
      nft?.image?.cachedUrl ||
      nft?.image?.pngUrl ||
      nft?.image?.thumbnailUrl ||
      nft?.image?.originalUrl ||
      nft?.rawMetadata?.image ||
      "";

    if (!map.has(contract)) map.set(contract, { key: contract, name: colName, count: 0, items: [] });

    const entry = map.get(contract);
    entry.count++;
    entry.items.push({ name, tokenId, contract, image, sourceKey: contract });
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}

// ---------- Export ----------
async function exportPNG() {
  try {
    setStatus("Exporting… may take a moment");

    const tiles = Array.from(document.querySelectorAll("#grid .tile"));
    if (!tiles.length) return setStatus("Nothing to export. Build grid first.");

    const gridEl = $("grid");
    const cols = getComputedGridCols(gridEl);
    const rows = Math.ceil(tiles.length / cols);

    const rect = tiles[0].getBoundingClientRect();
    let tileSize = Math.round(rect.width);
    if (!tileSize || tileSize < 10) tileSize = 140;

    const scale = 2;
    const pad = 2;
    const borderPx = 2;

    const outW = Math.round((cols * tileSize + pad * 2) * scale);
    const outH = Math.round((rows * tileSize + pad * 2) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, outW, outH);

    for (let i = 0; i < tiles.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;

      const x = Math.round((pad + c * tileSize) * scale);
      const y = Math.round((pad + r * tileSize) * scale);
      const size = Math.round(tileSize * scale);

      const srcDirect = tiles[i].dataset?.src || "";

      try {
        if (srcDirect && srcDirect.length > 5) {
          const img = await loadImage(exportProxyUrl(srcDirect));
          drawCover(ctx, img, x, y, size, size);
        } else {
          drawPlaceholder(ctx, x, y, size, " ");
        }
      } catch (e) {
        drawPlaceholder(ctx, x, y, size, " ");
      }
    }

    const boxX = Math.round((pad + 4) * scale);
    const boxY = Math.round((pad + 4) * scale);
    const boxW = Math.round(tileSize * scale);

    const wmText = "⚡ Powered by Little Ollie Studio";

    const boxPadX = Math.round(6 * scale);
    const boxPadY = Math.round(4 * scale);
    const maxTextW = Math.max(10, boxW - boxPadX * 2);

    let fontPx = Math.round(Math.max(9, tileSize * 0.11) * scale);
    const minFontPx = Math.round(7 * scale);

    while (fontPx > minFontPx) {
      ctx.font = `900 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      if (ctx.measureText(wmText).width <= maxTextW) break;
      fontPx -= 1;
    }
    ctx.font = `900 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const finalText = ellipsizeToWidth(ctx, wmText, maxTextW);
    const boxH = Math.round(fontPx + boxPadY * 2);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textBaseline = "alphabetic";
    const textY = boxY + boxPadY + fontPx - Math.round(fontPx * 0.10);
    ctx.fillText(finalText, boxX + boxPadX, textY);

    ctx.strokeStyle = "rgba(109,224,255,0.70)";
    ctx.lineWidth = borderPx * scale;
    ctx.strokeRect(1, 1, outW - 2, outH - 2);

    canvas.toBlob((blob) => {
      if (!blob) return setStatus("Export failed: could not create PNG.");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "LO-FlexGrid.png";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus("Exported PNG ✅");
    }, "image/png");
  } catch (err) {
    const errorMsg = err?.message || "Export failed";
    setStatus(`❌ Export failed: ${errorMsg}. Please try again.`);
    addError(err, 'Export PNG');
  }
}

// ---------- Canvas helpers ----------
function getComputedGridCols(gridEl) {
  if (!gridEl) return 1;
  const cs = window.getComputedStyle(gridEl);
  const tmpl = cs.gridTemplateColumns || "";

  const m = tmpl.match(/repeat\((\d+),/);
  if (m) return Math.max(1, parseInt(m[1], 10));

  const parts = tmpl.split(" ").filter(Boolean);
  return Math.max(1, parts.length);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawPlaceholder(ctx, x, y, size, label) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x, y, size, size);

  if (label && label.trim()) {
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = `900 ${Math.round(size * 0.16)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + size / 2, y + size / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}

function drawCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const ir = iw / ih;
  const tr = w / h;

  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (ir > tr) {
    sh = ih;
    sw = ih * tr;
    sx = (iw - sw) / 2;
  } else {
    sw = iw;
    sh = iw / tr;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ---------- Events + Retry ----------
function bindEvents() {
  // Wallet input hardening
  const walletInput = $("walletInput");
  if (walletInput) {
    walletInput.autocapitalize = "none";
    walletInput.autocomplete = "off";
    walletInput.spellcheck = false;

    walletInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addWallet();
      }
    });
  }

  // ✅ Add wallet binding (ROBUST)
  const addBtn = $("addWalletBtn");
  if (addBtn) {
    addBtn.type = "button";
    let lastFire = 0;

    const handler = (e) => {
      try { e.preventDefault(); } catch {}
      const now = Date.now();
      if (now - lastFire < 350) return;
      lastFire = now;
      addWallet();
    };

    // click is the most reliable everywhere
    addBtn.addEventListener("click", handler, { passive: false });

    // pointer/touch helps on some iOS cases too (kept, but click remains primary)
    if (window.PointerEvent) {
      addBtn.addEventListener("pointerup", handler, { passive: false });
    } else {
      addBtn.addEventListener("touchend", handler, { passive: false });
    }
  }

  // grid size UI
  const gridSizeEl = $("gridSize");
  if (gridSizeEl) {
    gridSizeEl.addEventListener("change", () => {
      const wrap = $("customGridWrap");
      if (wrap) wrap.style.display = gridSizeEl.value === "custom" ? "" : "none";
      const exportBtn = $("exportBtn");
      if (exportBtn) exportBtn.disabled = true;
    });
  }

  const customRows = $("customRows");
  const customCols = $("customCols");
  const markExportDirty = () => {
    const exportBtn = $("exportBtn");
    if (exportBtn) exportBtn.disabled = true;
  };
  if (customRows) customRows.addEventListener("input", markExportDirty);
  if (customCols) customCols.addEventListener("input", markExportDirty);

  // chain change reset
  const chainSelect = $("chainSelect");
  if (chainSelect) {
    chainSelect.addEventListener("change", () => {
      state.collections = [];
      state.selectedKeys = new Set();
      renderCollectionsList();
      showControlsPanel(false);

      const grid = $("grid");
      if (grid) grid.innerHTML = "";

      const exportBtn = $("exportBtn");
      const buildBtn = $("buildBtn");
      if (buildBtn) buildBtn.disabled = true;
      if (exportBtn) exportBtn.disabled = true;

      setStatus("Chain changed ✅ Now 🔍 Load wallet(s) again.");
    });
  }

  // Enhanced retry missing tiles with exponential backoff
  async function retryMissingTiles() {
    const tiles = Array.from(document.querySelectorAll("#grid .tile[data-kind='missing']"));
    if (!tiles.length) {
      setStatus("✅ All images loaded!");
      return;
    }

    state.imageLoadState.retrying = tiles.length;
    setStatus(`🔄 Retrying ${tiles.length} missing image(s)…`);

    let attempted = 0;
    let successful = 0;

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const src = tile.dataset.src || "";
      const rawUrl = tile.dataset.rawUrl || src;
      if (!src) continue;

      let img = tile.querySelector("img");
      const missingOverlay = !!tile.querySelector(".fillerText");

      const needsRetry =
        tile.dataset.kind === "missing" ||
        missingOverlay ||
        !img ||
        !img.complete ||
        (img && img.naturalWidth === 0);

      if (!needsRetry) continue;
      attempted++;

      const delay = Math.min(500 * Math.pow(1.3, i), 3000);
      if (i > 0) await new Promise(resolve => setTimeout(resolve, delay));

      if (!img) {
        img = document.createElement("img");
        img.loading = "lazy";
        img.alt = "NFT";
        img.referrerPolicy = "no-referrer";
        img.crossOrigin = "anonymous";

        tile.innerHTML = "";
        tile.appendChild(img);
      } else if (missingOverlay) {
        tile.innerHTML = "";
        tile.appendChild(img);
      }

      tile.dataset.kind = "nft";
      tile.dataset.rawUrl = rawUrl;
      delete tile.dataset.loadStart; // reset budget timer for retries

      const retryCount = parseInt(tile.dataset.retryCount || "0");
      tile.dataset.retryCount = (retryCount + 1).toString();

      try {
        const success = await loadTileImage(tile, img, rawUrl, retryCount);
        if (success) {
          successful++;
          state.imageLoadState.failed = Math.max(0, state.imageLoadState.failed - 1);
        }
      } catch (e) {}

      state.imageLoadState.retrying = tiles.length - (i + 1);
      updateImageProgress();
    }

    state.imageLoadState.retrying = 0;
    if (successful > 0) {
      setStatus(`✅ Retry successful: ${successful} image(s) loaded. ${tiles.length - successful} still missing.`);
    } else {
      setStatus(`⚠️ Retry finished. ${attempted} tile(s) attempted, but none loaded. Some images may be unavailable.`);
    }
    updateImageProgress();
    try { syncWatermarkDOMToOneTile(); } catch {}
  }

  // Buttons
  const loadBtn = $("loadBtn");
  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");

  if (loadBtn) loadBtn.addEventListener("click", loadWallets);
  if (buildBtn) buildBtn.addEventListener("click", buildGrid);
  if (exportBtn) exportBtn.addEventListener("click", exportPNG);

  const selectAllBtn = $("selectAllBtn");
  const selectNoneBtn = $("selectNoneBtn");
  if (selectAllBtn) selectAllBtn.addEventListener("click", () => setAllCollections(true));
  if (selectNoneBtn) selectNoneBtn.addEventListener("click", () => setAllCollections(false));

  const retryBtn = $("retryBtn");
  if (retryBtn) {
    retryBtn.type = "button";
    retryBtn.addEventListener("click", retryMissingTiles);
  }

  const clearErrorLogBtn = $("clearErrorLog");
  if (clearErrorLogBtn) {
    clearErrorLogBtn.addEventListener("click", clearErrorLog);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) retryMissingTiles();
  });
  window.addEventListener("focus", retryMissingTiles);

  window.addEventListener("resize", syncWatermarkDOMToOneTile);
  window.addEventListener("orientationchange", syncWatermarkDOMToOneTile);
}

// Load configuration securely
async function initializeConfig() {
  try {
    const { loadConfig } = await import('./config.js');
    const config = await loadConfig();

    ALCHEMY_KEY = config.alchemyApiKey;
    IMG_PROXY = config.workerUrl;
    configLoaded = true;

    enableButtons();
    setStatus("Ready ✅ ➕ Add wallet(s) → 🔍 Load wallet(s) → select collections → 🧩 Build → 📸 Export");
    showConnectionStatus(false);
  } catch (error) {
    const statusEl = $("status");
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="color: #ff6b6b; font-weight: 900; margin-bottom: 8px;">
          ⚠️ Configuration Error
        </div>
        <div style="margin-bottom: 8px;">
          ${error.message}
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          See <strong>FLEX_GRID_SETUP.md</strong> for setup instructions.
        </div>
      `;
    }

    addError(error, 'Config Loading');

    const loadBtn = $("loadBtn");
    const buildBtn = $("buildBtn");
    const exportBtn = $("exportBtn");
    if (loadBtn) loadBtn.disabled = true;
    if (buildBtn) buildBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;

    showConnectionStatus(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  initializeConfig();
  enableButtons();
});

enableButtons();
