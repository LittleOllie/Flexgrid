/**
 * Flex Grid Configuration (Simple + Reliable)
 *
 * Works on:
 * - GitHub Pages (littleollie.github.io)
 * - localhost
 * - LAN IP (for iPhone testing)
 */

const IS_BROWSER = typeof window !== "undefined";
const HOSTNAME = IS_BROWSER ? window.location.hostname : "";

// 👇 EDIT THIS if your IP changes (optional, not needed for GitHub Pages)
const LOCAL_IPS = [
  "127.0.0.1",
  "localhost",
  "192.168.0.15"
];

// ✅ Allowed frontends (GitHub Pages + local dev)
const ALLOW_FRONTEND_CONFIG =
  HOSTNAME === "littleollie.github.io" ||
  HOSTNAME.endsWith(".github.io") ||
  HOSTNAME === "localhost" ||
  HOSTNAME === "127.0.0.1";

// ============================================
// FRONTEND CONFIG (USED ON GitHub Pages + localhost)
// ============================================

const FRONTEND_CONFIG = {
  enabled: false, // turn TRUE only for local dev
  alchemyApiKey: null, // DEV ONLY (don’t commit keys)
  workerUrl: "https://loflexgrid.littleollienft.workers.dev/img?url=",
  localWorkerUrl: "http://localhost:3000/api/proxy/image?url=",
};

// ============================================
// LOAD CONFIG
// ============================================

async function loadConfig() {
  if (!IS_BROWSER) throw new Error("Config can only be loaded in the browser.");

  // 1) Try backend first (localhost only)
  if (HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("http://localhost:3000/api/config/flex-grid", {
        method: "GET",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const config = await response.json();
        if (config?.alchemyApiKey && config?.workerUrl) {
          console.log("✅ Config loaded from backend");
          return config;
        }
      }
    } catch (err) {
      console.warn("⚠️ Backend config not available:", err.message);
    }
  }

  // 2) Frontend fallback (DEV ONLY)
  if (FRONTEND_CONFIG.enabled) {
    if (!ALLOW_FRONTEND_CONFIG) {
      throw new Error("Frontend config blocked for this hostname.");
    }
    if (!FRONTEND_CONFIG.alchemyApiKey) {
      throw new Error("DEV MODE: alchemyApiKey missing.");
    }

    const worker =
      (HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1")
        ? FRONTEND_CONFIG.localWorkerUrl
        : FRONTEND_CONFIG.workerUrl;

    console.warn("⚠️ DEV MODE: Using frontend config", { hostname: HOSTNAME, worker });

    return {
      alchemyApiKey: FRONTEND_CONFIG.alchemyApiKey,
      workerUrl: worker,
    };
  }

  // 3) Hard fail
  const errorMsg =
`Configuration not available for hostname: ${HOSTNAME}

Backend config failed.

For localhost:
  cd backend && npm run dev

GitHub Pages:
  hostname should be littleollie.github.io or end with .github.io

Allowed hosts:
  localhost, 127.0.0.1, littleollie.github.io, *.github.io`;

  console.error(errorMsg);
  throw new Error(errorMsg);
}

export { loadConfig, FRONTEND_CONFIG };