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

// ---- Export watermark (single source of truth) ----
const EXPORT_WATERMARK_TEXT = "⚡ Powered by Little Ollie";


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

// ---------- Image loading tune ----------
const IMG_LOAD = {
  gridTimeoutMs: 25000,     // ✅ longer time to load
  gridDirectTimeoutMs: 20000,
  retriesPerCandidate: 1,   // extra tries per URL
  backoffMs: 500,           // wait between attempts
};

// Prefer reliable gateways first (you can reorder later)
const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
];

function setImgCORS(imgEl, enabled) {
  try {
    if (!imgEl) return;
    if (enabled) {
      imgEl.crossOrigin = "anonymous";
    } else {
      imgEl.removeAttribute("crossorigin");
      imgEl.crossOrigin = null;
    }
  } catch (_) {}
}

// ---------- Timeout wrapper for image loading ----------
function loadImgWithTimeout(imgEl, src, timeout = 25000) {
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
    ),
  ]);
}

function loadImgWithLimiter(imgEl, src, timeout = 25000) {
  return gridImgLimit(() => loadImgWithTimeout(imgEl, src, timeout));
}

// Non-limited (for direct fallback)
function loadImgNoLimit(imgEl, src, timeout = 20000) {
  return loadImgWithTimeout(imgEl, src, timeout);
}

// ---------- UI helpers ----------
const errorLog = {
  errors: [],
  maxErrors: 50,
};

function addError(error, context = "") {
  const timestamp = new Date().toLocaleTimeString();
  const errorEntry = {
    timestamp,
    message: error?.message || String(error),
    context,
    stack: error?.stack,
    fullError: error,
  };

  errorLog.errors.unshift(errorEntry);
  if (errorLog.errors.length > errorLog.maxErrors) {
    errorLog.errors = errorLog.errors.slice(0, errorLog.maxErrors);
  }

  updateErrorLogDisplay();
}

function updateErrorLogDisplay() {
  const errorLogEl = $("errorLog");
  const errorLogContent = $("errorLogContent");

  if (!errorLogEl || !errorLogContent) return;

  if (errorLog.errors.length === 0) {
    errorLogEl.style.display = "none";
    return;
  }

  errorLogEl.style.display = "block";
  errorLogContent.innerHTML = errorLog.errors
    .map((err) => {
      const contextText = err.context
        ? ` <span style="opacity: 0.7;">[${err.context}]</span>`
        : "";
      const stackText =
        err.stack && window.location.hostname === "localhost"
          ? `<div style="margin-top: 4px; padding-left: 12px; opacity: 0.6; font-size: 10px;">${err.stack
              .split("\n")
              .slice(0, 3)
              .join("<br>")}</div>`
          : "";
      return `
      <div style="padding: 6px 0; border-bottom: 1px solid rgba(244, 67, 54, 0.2);">
        <div style="color: #f44336; font-weight: 700;">
          <span style="opacity: 0.7; font-size: 10px;">[${err.timestamp}]</span>${contextText}
        </div>
        <div style="margin-top: 2px; color: #ffcdd2;">${err.message}</div>
        ${stackText}
      </div>
    `;
    })
    .join("");
}

function clearErrorLog() {
  errorLog.errors = [];
  updateErrorLogDisplay();
}

function showConnectionStatus(connected) {
  const statusEl = $("connectionStatus");
  const lightEl = $("connectionLight");
  const textEl = $("connectionText");

  if (!statusEl) return;

  statusEl.style.display = "flex";

  if (connected) {
    statusEl.style.background = "rgba(76, 175, 80, 0.15)";
    statusEl.style.borderColor = "rgba(76, 175, 80, 0.3)";
    if (lightEl) {
      lightEl.style.background = "#4CAF50";
      lightEl.style.boxShadow = "0 0 8px rgba(76, 175, 80, 0.6)";
    }
    if (textEl) {
      textEl.textContent = "Connected";
      textEl.style.color = "#4CAF50";
    }
  } else {
    statusEl.style.background = "rgba(244, 67, 54, 0.15)";
    statusEl.style.borderColor = "rgba(244, 67, 54, 0.3)";
    if (lightEl) {
      lightEl.style.background = "#f44336";
      lightEl.style.boxShadow = "0 0 8px rgba(244, 67, 54, 0.6)";
    }
    if (textEl) {
      textEl.textContent = "Not Connected";
      textEl.style.color = "#f44336";
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
  // ✅ FIX: IMG_PROXY can be null before config loads
  return typeof url === "string" && !!IMG_PROXY && url.startsWith(IMG_PROXY);
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

function safeProxyUrl(src) {
  if (!src) return "";
  if (isAlreadyProxied(src)) return src;

  const direct = normalizeImageUrl(src);
  if (isAlreadyProxied(direct)) return direct;

  return IMG_PROXY + encodeURIComponent(direct);
}

function gridProxyUrl(src) {
  const prox = safeProxyUrl(src);
  return prox + (prox.includes("?") ? "&" : "?") + "b=" + BUILD_ID;
}

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
  const wm = document.getElementById("wmGrid");
  const grid = document.getElementById("grid");
  if (!wm || !grid) return;

  const firstTile = grid.querySelector(".tile");
  if (!firstTile) {
    wm.style.display = "none";
    return;
  }

  // keep watermark as overlay (survives rebuild)
  const gridWrap = grid.parentElement; // .gridWrap
  if (wm.parentElement !== gridWrap) gridWrap.appendChild(wm);

  wm.style.display = "block";
  wm.textContent = "⚡ Powered by Little Ollie Studio";

  // badge base styling (always)
  wm.style.position = "absolute";
  wm.style.left = "2px";
  wm.style.top = "2px";
  wm.style.zIndex = "9999";
  wm.style.pointerEvents = "none";

  wm.style.background = "rgba(0,0,0,0.35)";
  wm.style.border = "1px solid rgba(255,255,255,0.22)";
  wm.style.borderRadius = "10px";
  wm.style.boxShadow = "0 6px 16px rgba(0,0,0,0.25)";

  wm.style.color = "rgba(255,255,255,0.95)";
  wm.style.fontWeight = "900";
  wm.style.letterSpacing = ".2px";
  wm.style.lineHeight = "1";
  wm.style.whiteSpace = "nowrap";

  // lock to tile width
  const tileW = firstTile.getBoundingClientRect().width || 0;
  const maxW = Math.max(70, Math.floor(tileW - 4));
  wm.style.maxWidth = maxW + "px";

  // ✅ compute font + padding from tile size (so they always match)
  const fontPx = Math.max(9, Math.min(14, Math.round(tileW * 0.08)));
  const padY = Math.max(2, Math.round(fontPx * 0.45));
  const padX = Math.max(4, Math.round(fontPx * 0.85));

  wm.style.fontSize = fontPx + "px";
  wm.style.padding = `${padY}px ${padX}px`;

  // ✅ if still too wide, gently shrink font + padding together
  requestAnimationFrame(() => {
    const wNow = wm.getBoundingClientRect().width || 0;
    if (wNow > maxW) {
      const ratio = maxW / wNow;
      const newFont = Math.max(8, Math.floor(fontPx * ratio));
      const newPadY = Math.max(2, Math.round(newFont * 0.45));
      const newPadX = Math.max(4, Math.round(newFont * 0.85));

      wm.style.fontSize = newFont + "px";
      wm.style.padding = `${newPadY}px ${newPadX}px`;
    }
  });
}

// ---------- Wallet list ----------
function normalizeWallet(w) {
  return (w || "").trim().replace(/\s+/g, "").toLowerCase();
}

function addWallet() {
  const input = $("walletInput");
  const w = normalizeWallet(input ? input.value : "");

  if (!w) return setStatus("Paste a wallet address first.");
  if (!/^0x[a-f0-9]{40}$/.test(w))
    return setStatus("That doesn’t look like a valid 0x wallet address.");
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
  gridImgLimit = createLimiter(3);
  BUILD_ID = Date.now();

  state.imageLoadState = {
    total: 0,
    loaded: 0,
    failed: 0,
    retrying: 0,
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

  const nftsWithImages = usedItems.filter((item) => item?.image);
state.imageLoadState.total = nftsWithImages.length;

for (let i = 0; i < usedItems.length; i++) grid.appendChild(makeNFTTile(usedItems[i]));
const remaining = totalSlots - usedItems.length;
for (let j = 0; j < remaining; j++) grid.appendChild(makeFillerTile());

const wm = $("wmGrid");
if (wm) wm.style.display = "block";

requestAnimationFrame(syncWatermarkDOMToOneTile);

if (exportBtn) exportBtn.disabled = false;

if (state.imageLoadState.total > 0) updateImageProgress();
else setStatus("Grid built ✅ (drag tiles to reorder on desktop)");

enableDragDrop();

}

// ---------- Image loading + fallbacks ----------
const MISSING_GRACE_MS = 30000;

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
  try {
    if (img && img.parentNode) img.remove();
  } catch (e) {}
  tile.dataset.kind = "missing";

  const src = tile.dataset.src || "";
  if (!tile.querySelector(".fillerText")) tile.appendChild(makeMissingInner());

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    console.warn("❌ Tile missing", {
      contract: tile.dataset.contract,
      tokenId: tile.dataset.tokenId,
      src,
      rawUrl,
      ipfsPath: tile.dataset.ipfsPath,
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

async function loadTileImage(tile, img, rawUrl, retryAttempt = 0) {
  const contract = tile.dataset.contract || "";
  const tokenId = tile.dataset.tokenId || "";

  const ipfsPath = getIpfsPath(rawUrl);
  tile.dataset.ipfsPath = ipfsPath || "";

  const directNormalized = normalizeImageUrl(rawUrl);
  if (!directNormalized) {
    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();
    return false;
  }

  const primary = ipfsPath ? "ipfs://" + ipfsPath : directNormalized;
  tile.dataset.src = primary;

  // Strategy 1: Alchemy cached URL (proxy first)
  if (contract && tokenId && tile.dataset.alchemyTried !== "1") {
    tile.dataset.alchemyTried = "1";
    try {
      const metaUrl = await fetchBestAlchemyImage({ contract, tokenId, host: state.host });
      if (metaUrl && metaUrl !== primary) {
        try {
          setImgCORS(img, true);
          await loadImgWithLimiter(img, gridProxyUrl(metaUrl), IMG_LOAD.gridTimeoutMs);
          state.imageLoadState.loaded++;
          updateImageProgress();
          tile.dataset.kind = "loaded";
          tile.dataset.src = metaUrl;
          return true;
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Strategy 2: Worker proxy (primary)
  try {
    setImgCORS(img, true);
    await loadImgWithLimiter(img, gridProxyUrl(primary), IMG_LOAD.gridTimeoutMs);
    state.imageLoadState.loaded++;
    updateImageProgress();
    tile.dataset.kind = "loaded";
    return true;
  } catch (e1) {
    // Strategy 3: Direct (DISPLAY-ONLY) fallback (non-IPFS only)
    if (!ipfsPath && /^https?:\/\//i.test(primary)) {
      try {
        setImgCORS(img, false);
        await loadImgNoLimit(img, primary, IMG_LOAD.gridDirectTimeoutMs);
        state.imageLoadState.loaded++;
        updateImageProgress();
        tile.dataset.kind = "loaded";
        return true;
      } catch (_) {
        // continue
      } finally {
        setImgCORS(img, true);
      }
    }

    // Strategy 4: IPFS gateways (via Worker proxy)
    if (ipfsPath) {
      const candidates = IPFS_GATEWAYS.map((g) => g + ipfsPath);

      for (const gatewayUrl of candidates) {
        for (let attempt = 0; attempt <= IMG_LOAD.retriesPerCandidate; attempt++) {
          try {
            setImgCORS(img, true);
            await loadImgWithLimiter(img, gridProxyUrl(gatewayUrl), IMG_LOAD.gridTimeoutMs);
            state.imageLoadState.loaded++;
            updateImageProgress();
            tile.dataset.kind = "loaded";
            tile.dataset.src = gatewayUrl;
            return true;
          } catch (_) {
            if (attempt < IMG_LOAD.retriesPerCandidate) {
              await new Promise((r) => setTimeout(r, IMG_LOAD.backoffMs));
            }
          }
        }
      }
    }

    // Grace period before Missing
    const startedAt = Number(tile.dataset.loadStartedAt || Date.now());
    const elapsed = Date.now() - startedAt;

    if (elapsed < MISSING_GRACE_MS) {
      const waitMs = MISSING_GRACE_MS - elapsed;
      state.imageLoadState.retrying++;
      updateImageProgress();

      await new Promise((r) => setTimeout(r, waitMs));

      state.imageLoadState.retrying = Math.max(0, state.imageLoadState.retrying - 1);
      updateImageProgress();

      try {
        setImgCORS(img, true);
        await loadImgWithLimiter(img, gridProxyUrl(primary), IMG_LOAD.gridTimeoutMs);
        state.imageLoadState.loaded++;
        updateImageProgress();
        tile.dataset.kind = "loaded";
        return true;
      } catch (_) {}
    }

    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();

    if (retryAttempt === 0) {
      addError(new Error(`Failed to load image: ${String(rawUrl).substring(0, 100)}`), "Image Loading");
    }

    return false;
  } // ✅ END catch
} // ✅ END loadTileImage (THIS WAS MISSING BEFORE)

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
    tile.dataset.loadStartedAt = String(Date.now());
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
    addError(err, "Load Wallets");
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

  while (all.length < hardCap) {
    const url = new URL(baseUrl);
    url.searchParams.set("owner", wallet);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", "100");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Alchemy API error (${res.status}): ${errorText.substring(0, 100)}`);
    }

    const json = await res.json();
    if (json.error) throw new Error(`Alchemy API error: ${json.error.message || JSON.stringify(json.error)}`);

    all.push(...(json.ownedNfts || []));
    if (!json.pageKey) break;
    pageKey = json.pageKey;
  }

  return all;
}

async function fetchAlchemyNFTMetadata({ contract, tokenId, host }) {
  const url = new URL(`https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTMetadata`);
  url.searchParams.set("contractAddress", contract);
  url.searchParams.set("tokenId", tokenId);
  url.searchParams.set("refreshCache", "false");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Alchemy metadata error (${res.status})`);

  const json = await res.json();
  if (json.error) throw new Error(`Alchemy metadata error: ${json.error.message || JSON.stringify(json.error)}`);
  return json;
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

// ---------- Export + helpers ----------
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function loadImageWithRetry(src, tries = 2, timeoutMs = 25000) {
  let lastErr = null;

  for (let i = 0; i < tries; i++) {
    try {
      // lightweight timeout wrapper
      const img = await Promise.race([
        loadImage(src),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Image load timeout")), timeoutMs)),
      ]);
      return img;
    } catch (e) {
      lastErr = e;
      await sleep(250 + i * 250);
    }
  }
  throw lastErr || new Error("Image failed: " + src);
}

function drawPlaceholder(ctx, x, y, w, h, label = "Missing") {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(2, Math.floor(w * 0.02));
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const fontPx = Math.max(14, Math.floor(w * 0.10));
  ctx.font = `800 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
}

function drawLightningIcon(ctx, x, y, size) {
  // Simple bolt shape (always works, no emoji dependency)
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(size * 0.55, 0);
  ctx.lineTo(size * 0.10, size * 0.60);
  ctx.lineTo(size * 0.48, size * 0.60);
  ctx.lineTo(size * 0.30, size);
  ctx.lineTo(size * 0.90, size * 0.40);
  ctx.lineTo(size * 0.55, size * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWatermarkAcrossTile(ctx, x, y, w, h) {
  const text = "Powered by Little Ollie Studio";

  ctx.save();

  // position near top-left of the first tile
  const padX = Math.max(3, Math.round(w * 0.02));
  const padY = Math.max(3, Math.round(h * 0.02));
  const bx = x + padX;
  const by = y + padY;

  // font sizing
  let fontPx = Math.max(11, Math.floor(w * 0.085));
  const minFontPx = 9;

  const fontStack =
    "system-ui, -apple-system, Segoe UI, Roboto, Arial, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji";

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // padding inside badge
  const padInsideX = () => Math.round(fontPx * 0.75);
  const padInsideY = () => Math.round(fontPx * 0.55);

  // emoji size + spacing
  const boltSize = Math.round(fontPx * 1.05);
  const boltGap = Math.round(fontPx * 0.35);

  const maxBoxW = Math.round(w * 0.92);

  // shrink-to-fit
  while (fontPx > minFontPx) {
    ctx.font = `900 ${fontPx}px ${fontStack}`;
    const textW = ctx.measureText(text).width;
    const boxW = Math.round(textW + padInsideX() * 2 + boltSize + boltGap);
    if (boxW <= maxBoxW) break;
    fontPx--;
  }

  ctx.font = `900 ${fontPx}px ${fontStack}`;
  const textW = ctx.measureText(text).width;

  const boxPadX = padInsideX();
  const boxPadY = padInsideY();

  const boxW = Math.min(maxBoxW, Math.round(textW + boxPadX * 2 + boltSize + boltGap));
  const boxH = Math.round(Math.max(fontPx, boltSize) + boxPadY * 2);

  // rounded rect badge
  const r = Math.max(7, Math.round(fontPx * 0.7));
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = Math.max(1, Math.round(w * 0.006));

  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + boxW - r, by);
  ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  ctx.lineTo(bx + boxW, by + boxH - r);
  ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  ctx.lineTo(bx + r, by + boxH);
  ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ⚡ emoji (yellow)
  ctx.font = `900 ${boltSize}px ${fontStack}`;
  ctx.fillText("⚡", bx + boxPadX, by + boxPadY);

  // text
  ctx.font = `900 ${fontPx}px ${fontStack}`;
  const textX = bx + boxPadX + boltSize + boltGap;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, textX, by + boxPadY);

  ctx.restore();
}


async function saveCanvasPNG(canvas, filename = "little-ollie-grid.png") {
  // Use blob (best quality + memory)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));

  // If blob fails, fallback to dataURL
  if (!blob) {
    const dataUrl = canvas.toDataURL("image/png");
    if (isIOS()) {
      const win = window.open(dataUrl, "_blank");
      if (!win) alert("Popup blocked. Allow popups to save the PNG.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  // ✅ iPhone/iPad: open in new tab so user can long-press → Save Image
  if (isIOS()) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      alert("Popup blocked. Allow popups to save the PNG.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return;
  }

  // ✅ Desktop: download normally
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function isImgUsable(img){
  return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}

function drawPlaceholder(ctx, x, y, w, h, label="MISSING"){
  // background
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x, y, w, h);

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x+1, y+1, w-2, h-2);

  // text
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 ${Math.max(10, Math.round(w*0.12))}px system-ui, -apple-system`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + Math.round(w*0.08), y + Math.round(h*0.5));
}


async function exportPNG() {
  try {
    setStatus("Exporting…");

    const tiles = [...document.querySelectorAll("#grid .tile")];
    if (!tiles.length) return setStatus("Nothing to export");

    const grid = $("grid");
    const cols = getComputedGridCols(grid);
    const rows = Math.ceil(tiles.length / cols);

    // TRUE tile size (iOS fix)
    const rect = tiles[0].getBoundingClientRect();
    let tileSize = Math.round(rect.width);
    if (tileSize < 40) tileSize = 120;

    // Retina scale
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(3, dpr * 2); // crisp but safe

    const pad = 4;

    const outW = Math.round((cols * tileSize + pad * 2) * scale);
    const outH = Math.round((rows * tileSize + pad * 2) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.imageSmoothingQuality = "high";

    ctx.clearRect(0,0,outW,outH);

    // draw tiles
let i = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const tile = tiles[i++];
    if (!tile) continue;

    const img = tile.querySelector("img");
    const x = pad + c * tileSize;
    const y = pad + r * tileSize;

    // broken image protection (iPhone fix)
    if (!isImgUsable(img)) {
      drawPlaceholder(ctx, x, y, tileSize, tileSize, "⚡");
      continue;
    }

    try {
      ctx.drawImage(img, x, y, tileSize, tileSize);
    } catch (e) {
      console.warn("⚠️ drawImage failed", e);
      drawPlaceholder(ctx, x, y, tileSize, tileSize, "⚡");
    }
  }
}


// ---- WATERMARK (stable on iPhone + desktop) ----
const wmText = EXPORT_WATERMARK_TEXT;

// lock to first tile
const maxW = tileSize * 0.92;
const minFont = 9;
const maxFont = Math.round(tileSize * 0.22);

let fontSize = maxFont;

while (fontSize > minFont) {
  ctx.font = `900 ${fontSize}px system-ui, -apple-system`;
  if (ctx.measureText(wmText).width <= maxW) break;
  fontSize--;
}

ctx.font = `900 ${fontSize}px system-ui, -apple-system`;
ctx.textBaseline = "top";

const wmPad = Math.max(4, Math.round(fontSize * 0.35));
const textW = ctx.measureText(wmText).width;

const boxW = Math.min(textW + pad * 2, maxW);
const boxH = fontSize + pad * 2;

const bx = 6;
const by = 6;

// background
ctx.fillStyle = "rgba(0,0,0,0.65)";
ctx.fillRect(bx, by, boxW, boxH);

// text
ctx.fillStyle = "#ffd22e";
ctx.fillText(wmText, bx + pad, by + pad);


    // export
    const url = canvas.toDataURL("image/png",1);

    const a = document.createElement("a");
    a.href = url;
    a.download = "lo-grid.png";
    a.click();

    setStatus("Saved ✔");

  } catch(err){
    console.error(err);
    setStatus("Export failed");
  }
}


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
// ---------- Events + Retry ----------
(function bindEvents() {
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

    if (window.PointerEvent) addBtn.addEventListener("pointerup", handler, { passive: false });
    else {
      addBtn.addEventListener("click", handler, { passive: false });
      addBtn.addEventListener("touchend", handler, { passive: false });
    }
  }

  // ✅ Select all / none (Collections panel)
  const selectAllBtn = $("selectAllBtn");
  const selectNoneBtn = $("selectNoneBtn");
  if (selectAllBtn) selectAllBtn.addEventListener("click", () => setAllCollections(true));
  if (selectNoneBtn) selectNoneBtn.addEventListener("click", () => setAllCollections(false));

  // Main actions
  const loadBtn = $("loadBtn");
  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");
  if (loadBtn) loadBtn.addEventListener("click", loadWallets);
  if (buildBtn) buildBtn.addEventListener("click", buildGrid);
  if (exportBtn) exportBtn.addEventListener("click", exportPNG);

  // ✅ Retry missing (if button exists)
  const retryBtn = $("retryBtn");
  if (retryBtn && typeof retryMissingTiles === "function") {
    retryBtn.addEventListener("click", retryMissingTiles);
  }

  // ✅ Clear error log (if button exists)
  const clearErrBtn = $("clearErrorLog");
  if (clearErrBtn) clearErrBtn.addEventListener("click", clearErrorLog);

  // Watermark keeps fitting on resize
  window.addEventListener("resize", syncWatermarkDOMToOneTile);
  window.addEventListener("orientationchange", syncWatermarkDOMToOneTile);
})();

// Load configuration securely
async function initializeConfig() {
  try {
    const { loadConfig } = await import("./config.js");
    const config = await loadConfig();

    ALCHEMY_KEY = config.alchemyApiKey;
    IMG_PROXY = config.workerUrl;
    configLoaded = true;

    console.log("✅ configLoaded", {
      configLoaded,
      hasAlchemyKey: !!ALCHEMY_KEY,
      IMG_PROXY,
    });

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
    addError(error, "Config Loading");

    const loadBtn = $("loadBtn");
    const buildBtn = $("buildBtn");
    const exportBtn = $("exportBtn");
    if (loadBtn) loadBtn.disabled = true;
    if (buildBtn) buildBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;

    showConnectionStatus(false);
  }
}

initializeConfig();
enableButtons();
