/**
 * Flex Grid Configuration (Simple + Reliable)
 *
 * This version is designed to work on:
 * - GitHub Pages (littleollie.github.io)
 * - localhost
 *
 * If you later add a real backend, you can switch to backend-only config.
 */

const IS_BROWSER = typeof window !== "undefined";
const HOSTNAME = IS_BROWSER ? window.location.hostname : "";

// ✅ Treat these as “allowed dev-style hosting” (GitHub Pages + localhost)
// Add your custom domain here if you use one, e.g. "flexgrid.littleollie.com"
const ALLOW_FRONTEND_CONFIG =
  HOSTNAME === "localhost" ||
  HOSTNAME.endsWith("github.io");

// ============================================
// FRONTEND CONFIG (USED ON GitHub Pages + localhost)
// ============================================

const FRONTEND_CONFIG = {
  enabled: ALLOW_FRONTEND_CONFIG,

  // ⚠️ Frontend keys are not truly secret — restrict this key in Alchemy by domain.
  alchemyApiKey: "GYuepn7j7XCslBzxLwO5M",

  // Image proxy (Worker) — this MUST be reachable from GitHub Pages
  workerUrl: "https://loflexgrid.littleollienft.workers.dev/img?url=",

  // Optional local proxy (only if you run it)
  localWorkerUrl: "http://localhost:3000/api/proxy/image?url=",
};

// ============================================
// LOAD CONFIG
// ============================================

async function loadConfig() {
  if (!IS_BROWSER) {
    throw new Error("Config can only be loaded in the browser.");
  }

  // 1) If on localhost and you have a backend config endpoint, try it
  if (HOSTNAME === "localhost") {
    try {
      const response = await fetch("http://localhost:3000/api/config/flex-grid", {
        method: "GET",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const config = await response.json();
        if (config?.alchemyApiKey && config?.workerUrl) {
          console.log("✅ Config: loaded from localhost backend endpoint");
          return config;
        }
      }
      console.warn("⚠️ Config: localhost backend endpoint not usable, falling back…");
    } catch (err) {
      console.warn("⚠️ Config: backend endpoint not available, falling back…", err?.message || err);
    }
  }

  // 2) Frontend config for GitHub Pages / localhost
  if (FRONTEND_CONFIG.enabled) {
    const chosenWorker =
      HOSTNAME === "localhost" ? FRONTEND_CONFIG.localWorkerUrl : FRONTEND_CONFIG.workerUrl;

    console.log("✅ Config: using frontend config", {
      hostname: HOSTNAME,
      workerUrl: chosenWorker,
    });

    return {
      alchemyApiKey: FRONTEND_CONFIG.alchemyApiKey,
      workerUrl: chosenWorker,
    };
  }

  // 3) Nothing available
  console.error("❌ Config: not enabled for this hostname:", HOSTNAME);
  throw new Error(
    "Configuration not available for this site.\n\n" +
    `Hostname: ${HOSTNAME}\n\n` +
    "If you're using GitHub Pages, hostname should end with github.io.\n" +
    "If you're using a custom domain, add it to ALLOW_FRONTEND_CONFIG in config.js."
  );
}

export { loadConfig, FRONTEND_CONFIG };
