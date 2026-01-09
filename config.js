/**
 * Flex Grid Configuration (Clean + GitHub Pages friendly)
 *
 * Goals:
 * - Works on GitHub Pages (no backend required)
 * - Works on localhost (optional local backend proxy)
 * - Avoids DEV config accidentally running in production
 *
 * SECURITY NOTE:
 * - Any API key in frontend JS can be extracted by someone determined.
 * - For true security, move Alchemy calls behind your own backend.
 */

// ============================================
// DEV / LOCAL CONFIG (ONLY USED ON localhost)
// ============================================

const DEV_CONFIG = {
  // ✅ Only enable DEV_CONFIG on localhost
enabled:
  (typeof window !== "undefined" &&
   (window.location.hostname === "localhost" || window.location.hostname.endsWith("github.io"))),

  // Development API key (rotate if ever exposed publicly)
  alchemyApiKey: "GYuepn7j7XCslBzxLwO5M",

  // Proxy URL to use for images
  // - On localhost: you CAN use your local proxy if you run it
  // - Else: default to Cloudflare Worker
  workerUrl:
    (typeof window !== "undefined" && window.location.hostname === "localhost")
      ? "http://localhost:3000/api/proxy/image?url="
      : "https://loflexgrid.littleollienft.workers.dev/img?url=",
};

// ============================================
// PRODUCTION CONFIG LOADING
// ============================================

/**
 * Load configuration
 * Order:
 * 1) Backend endpoint (ONLY on localhost, if running)
 * 2) Build-time env vars (if you ever bundle with Vite/etc)
 * 3) DEV_CONFIG fallback (ONLY on localhost)
 * 4) Throw error
 */
async function loadConfig() {
  const isBrowser = (typeof window !== "undefined");
  const hostname = isBrowser ? window.location.hostname : "";

  // --------------------------------------------
  // Method 1: Secure backend endpoint (localhost only)
  // --------------------------------------------
  if (hostname === "localhost") {
    try {
      const response = await fetch("http://localhost:3000/api/config/flex-grid", {
        method: "GET",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const config = await response.json();
        if (config?.alchemyApiKey && config?.workerUrl) {
          console.log("✅ Loaded config from secure backend endpoint");
          return config;
        }
      } else {
        // Non-fatal; continue to next method
        const errorData = await response.json().catch(() => ({}));
        console.warn(
          "⚠️ Backend config returned error:",
          errorData?.message || `HTTP ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.warn("⚠️ Secure config endpoint not available:", error?.message || error);
    }
  }

  // --------------------------------------------
  // Method 2: Build-time environment variables (optional)
  // --------------------------------------------
  // Only relevant if you use a bundler like Vite. Safe to keep as optional.
  try {
    // eslint-disable-next-line no-undef
    if (typeof import.meta !== "undefined" && import.meta.env) {
      // eslint-disable-next-line no-undef
      const envKey = import.meta.env.VITE_ALCHEMY_API_KEY;
      // eslint-disable-next-line no-undef
      const envWorker = import.meta.env.VITE_WORKER_URL;

      if (envKey && envWorker) {
        console.log("✅ Loaded config from environment variables");
        return { alchemyApiKey: envKey, workerUrl: envWorker };
      }
    }
  } catch (_) {
    // ignore
  }

  // --------------------------------------------
  // Method 3: DEV_CONFIG fallback (localhost only)
  // --------------------------------------------
  if (DEV_CONFIG.enabled) {
    console.warn("⚠️ Using DEV_CONFIG (localhost only) — NOT for production!");
    return {
      alchemyApiKey: DEV_CONFIG.alchemyApiKey,
      workerUrl: DEV_CONFIG.workerUrl,
    };
  }

  // --------------------------------------------
  // Method 4: No config available
  // --------------------------------------------
  throw new Error(
    "Configuration not available.\n\n" +
      "If you're on GitHub Pages / production:\n" +
      " - Put your Cloudflare Worker URL into config.js, and\n" +
      " - Provide an alchemyApiKey (note: frontend keys are not truly secret).\n\n" +
      "If you're on localhost:\n" +
      " - Run your backend at http://localhost:3000 OR enable DEV_CONFIG.\n"
  );
}

export { loadConfig, DEV_CONFIG };
