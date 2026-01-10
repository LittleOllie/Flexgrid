/**
 * Flex Grid Configuration (Secure + GitHub Pages Friendly)
 *
 * Priority:
 * 1) Local backend (dev) -> http://localhost:3000/api/config/flex-grid
 * 2) Cloudflare Worker config endpoint (prod) -> https://...workers.dev/api/config/flex-grid
 *
 * Frontend hardcoding remains OFF by default (secure).
 */

const IS_BROWSER = typeof window !== "undefined";
const HOSTNAME = IS_BROWSER ? window.location.hostname : "";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

// ✅ Your existing image proxy (already used)
const WORKER_IMG_PROXY = "https://loflexgrid.littleollienft.workers.dev/img?url=";

// ✅ NEW: a config endpoint you will add to your Worker
const WORKER_CONFIG_ENDPOINT = "https://loflexgrid.littleollienft.workers.dev/api/config/flex-grid";

const FRONTEND_CONFIG = {
  enabled: false,        // keep false unless you explicitly want unsafe dev mode
  alchemyApiKey: null,   // never commit keys
  workerUrl: WORKER_IMG_PROXY,
};

async function fetchJsonWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.substring(0, 120)}`);
    }

    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadConfig() {
  if (!IS_BROWSER) throw new Error("Config can only be loaded in the browser.");

  // 1) Local backend (dev)
  if (LOCAL_HOSTS.has(HOSTNAME)) {
    try {
      const cfg = await fetchJsonWithTimeout("http://localhost:3000/api/config/flex-grid", 5000);
      if (cfg?.alchemyApiKey && cfg?.workerUrl) {
        console.log("✅ Config loaded from LOCAL backend");
        return cfg;
      }
      console.warn("⚠️ Local backend returned invalid config:", cfg);
    } catch (e) {
      console.warn("⚠️ Local backend config not available:", e?.message || e);
      // continue to Worker fallback
    }
  }

  // 2) Worker config endpoint (GitHub Pages + any host)
  try {
    const cfg = await fetchJsonWithTimeout(WORKER_CONFIG_ENDPOINT, 5000);
    if (cfg?.alchemyApiKey && cfg?.workerUrl) {
      console.log("✅ Config loaded from WORKER endpoint");
      return cfg;
    }
    console.warn("⚠️ Worker returned invalid config:", cfg);
  } catch (e) {
    console.warn("⚠️ Worker config not available:", e?.message || e);
  }

  // 3) Frontend config (DEV ONLY — keep off)
  if (FRONTEND_CONFIG.enabled) {
    if (!FRONTEND_CONFIG.alchemyApiKey) {
      throw new Error("DEV MODE enabled but alchemyApiKey missing.");
    }
    console.warn("⚠️ DEV MODE: Using frontend config (unsafe)!");
    return {
      alchemyApiKey: FRONTEND_CONFIG.alchemyApiKey,
      workerUrl: FRONTEND_CONFIG.workerUrl,
    };
  }

  // 4) Hard fail (actionable)
  const errorMsg =
`Configuration not available.

Hostname: ${HOSTNAME}

Tried:
- Local backend: http://localhost:3000/api/config/flex-grid (dev only)
- Worker endpoint: ${WORKER_CONFIG_ENDPOINT}

Fix:
- Add /api/config/flex-grid route to your Cloudflare Worker (recommended)
- OR enable FRONTEND_CONFIG.enabled (unsafe, dev only)`;

  console.error("❌ Config error:", errorMsg);
  throw new Error(errorMsg);
}

export { loadConfig, FRONTEND_CONFIG };
