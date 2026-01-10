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
  // ⚠️ SECURITY: Frontend config disabled by default
  // Only enable for development if backend is not available
  // NEVER hardcode API keys in production code
  enabled: false, // Disabled for security - use backend config instead

  // ⚠️ TEMPORARY: For localhost testing only - REMOVE in production
  // API key will be provided via backend, but fallback for localhost if backend is down
  alchemyApiKey: null, // Must be set via backend .env file

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
  if (HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1") {
    try {
      // ✅ Add timeout using AbortController (more compatible)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch("http://localhost:3000/api/config/flex-grid", {
        method: "GET",
        credentials: "same-origin",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const config = await response.json();
        if (config?.alchemyApiKey && config?.workerUrl) {
          console.log("✅ Config: loaded from localhost backend endpoint");
          return config;
        } else {
          console.warn("⚠️ Config: Backend returned invalid config (missing alchemyApiKey or workerUrl)", config);
        }
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`⚠️ Config: Backend returned status ${response.status}: ${response.statusText}`, errorText.substring(0, 100));
      }
    } catch (err) {
      // Check if it's a timeout vs other error
      if (err.name === 'AbortError') {
        console.error("❌ Config: Backend request timed out after 5 seconds. Is backend running?");
        console.error("   → Check: curl http://localhost:3000/health");
      } else if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
        console.error("❌ Config: Cannot connect to backend. Is it running on port 3000?");
        console.error("   → Start backend: cd backend && npm run dev");
        console.error("   → Error:", err.message);
      } else {
        console.warn("⚠️ Config: Backend endpoint not available:", err?.message || err);
      }
      // Continue to fallback logic below - DON'T THROW YET
    }
  }

  // 2) Frontend config - DISABLED BY DEFAULT for security
  // Only enable for development if backend is not available
  if (FRONTEND_CONFIG.enabled) {
    // ⚠️ SECURITY WARNING: Frontend config should only be used in development
    if (HOSTNAME !== "localhost" && HOSTNAME !== "127.0.0.1") {
      console.error("❌ SECURITY: Frontend config is not allowed in production!");
      throw new Error(
        "Frontend config is disabled for security. " +
        "Please use backend config endpoint or environment variables."
      );
    }

    // Check if API key is set (should not be hardcoded)
    if (!FRONTEND_CONFIG.alchemyApiKey) {
      console.error("❌ Config: Frontend API key not set. Use backend config instead.");
      throw new Error(
        "API key must be provided via backend config endpoint. " +
        "See FLEX_GRID_SETUP.md for instructions."
      );
    }

    const chosenWorker =
      HOSTNAME === "localhost" ? FRONTEND_CONFIG.localWorkerUrl : FRONTEND_CONFIG.workerUrl;

    console.warn("⚠️ SECURITY: Using frontend config (development only)", {
      hostname: HOSTNAME,
      workerUrl: chosenWorker,
    });

    return {
      alchemyApiKey: FRONTEND_CONFIG.alchemyApiKey,
      workerUrl: chosenWorker,
    };
  }

  // 3) Nothing available - provide helpful error
  const errorMsg = `Configuration not available for hostname: ${HOSTNAME}\n\n` +
    `Backend config endpoint failed or is not accessible.\n\n` +
    `For localhost development:\n` +
    `  1. Make sure backend is running: cd backend && npm run dev\n` +
    `  2. Verify backend is accessible: curl http://localhost:3000/health\n` +
    `  3. Check that ALCHEMY_API_KEY is set in backend/.env file\n\n` +
    `If you're using GitHub Pages, hostname should end with github.io.\n` +
    `If you're using a custom domain, add it to ALLOW_FRONTEND_CONFIG in config.js.`;
  
  console.error("❌ Config error:", errorMsg);
  throw new Error(errorMsg);
}

export { loadConfig, FRONTEND_CONFIG };
