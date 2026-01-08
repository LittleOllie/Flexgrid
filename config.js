/**
 * Flex Grid Configuration
 * 
 * SECURITY: API keys should NEVER be hardcoded in production.
 * 
 * For production, use one of these options:
 * 1. Backend proxy (recommended) - Store keys server-side
 * 2. Environment variables - Use build-time env vars
 * 3. Secure config endpoint - Load from authenticated API
 * 
 * For development, you can temporarily set keys here,
 * but they MUST be removed before production deployment.
 * 
 * See FLEX_GRID_SETUP.md for detailed setup instructions.
 */

// ============================================
// DEVELOPMENT CONFIG (REMOVE IN PRODUCTION)
// ============================================
// ⚠️ WARNING: This is for development only!
// In production, load from secure endpoint or environment variables

const DEV_CONFIG = {
  // Set to true to use development config
  enabled: false,
  
  // Development API key (will be rotated)
  alchemyApiKey: "GYuepn7j7XCslBzxLwO5M",
  
  // Image proxy URL
  // Option 1: Backend proxy (recommended - no DNS issues)
  workerUrl: "http://localhost:3000/api/proxy/image?url=",
  
  // Option 2: Cloudflare Worker (has DNS issues currently)
  // workerUrl: "https://loflexgrid.littleollienft.workers.dev/img?url="
};

// ============================================
// PRODUCTION CONFIG LOADING
// ============================================

/**
 * Load configuration securely
 * Tries multiple methods in order of security
 */
async function loadConfig() {
  // Method 1: Load from secure backend endpoint (RECOMMENDED)
  // Default to localhost:3000 for development, or use relative path for same-origin
  const backendUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : ''; // Use relative path in production (same origin)
  
  try {
    const response = await fetch(`${backendUrl}/api/config/flex-grid`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const config = await response.json();
      if (config.alchemyApiKey && config.workerUrl) {
        // Only log in development
        if (window.location.hostname === 'localhost') {
          console.log('✅ Loaded config from secure backend endpoint');
        }
        return config;
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    // Only warn in development
    if (window.location.hostname === 'localhost') {
      console.warn('⚠️ Secure config endpoint not available:', error.message);
      console.warn('   Make sure backend server is running on port 3000');
      console.warn('   Or set up one of the other config methods');
    }
    throw error; // Re-throw to try next method
  }
  
  // Method 2: Load from environment variables (if using build system)
  // This would be set at build time, not runtime
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envKey = import.meta.env.VITE_ALCHEMY_API_KEY;
    const envWorker = import.meta.env.VITE_WORKER_URL;
    
    if (envKey && envWorker) {
      console.log('✅ Loaded config from environment variables');
      return {
        alchemyApiKey: envKey,
        workerUrl: envWorker
      };
    }
  }
  
  // Method 3: Development fallback (ONLY for local development)
  if (DEV_CONFIG.enabled) {
    console.warn('⚠️ Using development config - NOT for production!');
    return {
      alchemyApiKey: DEV_CONFIG.alchemyApiKey,
      workerUrl: DEV_CONFIG.workerUrl
    };
  }
  
  // Method 4: No config available
  throw new Error(
    'Configuration not available. ' +
    'Please set up secure config endpoint or environment variables. ' +
    'See FLEX_GRID_SETUP.md for instructions.'
  );
}

// Export config loader
export { loadConfig, DEV_CONFIG };

