/**
 * Cloudflare Worker Verification Script
 * 
 * Tests the image proxy worker to ensure it's working correctly
 * 
 * Usage:
 *   node verify-worker.js
 *   or open in browser console
 */

const WORKER_URL = "https://loflexgrid.littleollienft.workers.dev/img?url=";

// Test URLs
const TEST_URLS = {
  https: "https://via.placeholder.com/150",
  ipfs: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEy79qvW3pJgK",
  ipfsGateway: "https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEy79qvW3pJgK",
  alchemy: "https://nft-cdn.alchemy.com/eth-mainnet/abc123/image.png"
};

async function testWorker() {
  console.log("🔍 Testing Cloudflare Worker...\n");
  console.log(`Worker URL: ${WORKER_URL}\n`);

  const results = {
    accessible: false,
    cors: false,
    https: false,
    ipfs: false,
    errors: []
  };

  // Test 1: Check if worker is accessible
  console.log("Test 1: Worker Accessibility");
  try {
    const testUrl = WORKER_URL + encodeURIComponent("https://via.placeholder.com/150");
    const response = await fetch(testUrl, { method: 'HEAD' });
    
    if (response.ok || response.status === 200 || response.status === 206) {
      results.accessible = true;
      console.log("✅ Worker is accessible");
    } else {
      results.errors.push(`Worker returned status: ${response.status}`);
      console.log(`⚠️ Worker returned status: ${response.status}`);
    }
  } catch (error) {
    results.errors.push(`Worker not accessible: ${error.message}`);
    console.log(`❌ Worker not accessible: ${error.message}`);
    console.log("\n⚠️ Worker may be down or URL is incorrect");
    return results;
  }

  // Test 2: Check CORS headers
  console.log("\nTest 2: CORS Headers");
  try {
    const testUrl = WORKER_URL + encodeURIComponent("https://via.placeholder.com/150");
    const response = await fetch(testUrl, { method: 'OPTIONS' });
    const corsHeader = response.headers.get('access-control-allow-origin');
    
    if (corsHeader) {
      results.cors = true;
      console.log(`✅ CORS header present: ${corsHeader}`);
    } else {
      // Check on actual GET request
      const getResponse = await fetch(testUrl);
      const getCors = getResponse.headers.get('access-control-allow-origin');
      if (getCors) {
        results.cors = true;
        console.log(`✅ CORS header present: ${getCors}`);
      } else {
        results.errors.push("No CORS header found");
        console.log("⚠️ No CORS header found (may cause CORS errors)");
      }
    }
  } catch (error) {
    results.errors.push(`CORS test failed: ${error.message}`);
    console.log(`❌ CORS test failed: ${error.message}`);
  }

  // Test 3: Test HTTPS image
  console.log("\nTest 3: HTTPS Image Proxy");
  try {
    const testUrl = WORKER_URL + encodeURIComponent(TEST_URLS.https);
    const response = await fetch(testUrl);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        results.https = true;
        console.log(`✅ HTTPS image proxied successfully (${contentType})`);
      } else {
        results.errors.push(`Unexpected content type: ${contentType}`);
        console.log(`⚠️ Unexpected content type: ${contentType}`);
      }
    } else {
      results.errors.push(`HTTPS proxy failed: ${response.status}`);
      console.log(`❌ HTTPS proxy failed: ${response.status}`);
    }
  } catch (error) {
    results.errors.push(`HTTPS test error: ${error.message}`);
    console.log(`❌ HTTPS test error: ${error.message}`);
  }

  // Test 4: Test IPFS handling
  console.log("\nTest 4: IPFS Image Proxy");
  try {
    // Test with IPFS protocol URL
    const ipfsUrl = WORKER_URL + encodeURIComponent(TEST_URLS.ipfs);
    const response = await fetch(ipfsUrl);
    
    if (response.ok || response.status === 200) {
      results.ipfs = true;
      console.log("✅ IPFS image proxied successfully");
    } else {
      // Try with gateway URL
      const gatewayUrl = WORKER_URL + encodeURIComponent(TEST_URLS.ipfsGateway);
      const gatewayResponse = await fetch(gatewayUrl);
      
      if (gatewayResponse.ok) {
        results.ipfs = true;
        console.log("✅ IPFS gateway URL proxied successfully");
      } else {
        results.errors.push(`IPFS proxy failed: ${gatewayResponse.status}`);
        console.log(`⚠️ IPFS proxy returned status: ${gatewayResponse.status}`);
      }
    }
  } catch (error) {
    results.errors.push(`IPFS test error: ${error.message}`);
    console.log(`⚠️ IPFS test error: ${error.message}`);
    console.log("   (This is okay if IPFS gateway is slow)");
  }

  // Test 5: Response time
  console.log("\nTest 5: Response Time");
  try {
    const testUrl = WORKER_URL + encodeURIComponent("https://via.placeholder.com/150");
    const start = performance.now();
    const response = await fetch(testUrl);
    const end = performance.now();
    const time = Math.round(end - start);
    
    if (response.ok) {
      if (time < 2000) {
        console.log(`✅ Fast response: ${time}ms`);
      } else if (time < 5000) {
        console.log(`⚠️ Slow response: ${time}ms (may affect user experience)`);
      } else {
        console.log(`❌ Very slow response: ${time}ms (consider optimization)`);
        results.errors.push(`Slow response time: ${time}ms`);
      }
    }
  } catch (error) {
    console.log(`⚠️ Response time test failed: ${error.message}`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));
  console.log(`Worker Accessible: ${results.accessible ? "✅" : "❌"}`);
  console.log(`CORS Headers: ${results.cors ? "✅" : "⚠️"}`);
  console.log(`HTTPS Proxy: ${results.https ? "✅" : "❌"}`);
  console.log(`IPFS Proxy: ${results.ipfs ? "✅" : "⚠️"}`);
  
  if (results.errors.length > 0) {
    console.log(`\nErrors: ${results.errors.length}`);
    results.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  const allGood = results.accessible && results.cors && results.https;
  if (allGood) {
    console.log("\n✅ Worker is functioning correctly!");
  } else {
    console.log("\n⚠️ Worker has some issues. See errors above.");
  }

  return results;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testWorker, WORKER_URL, TEST_URLS };
  
  // Auto-run when executed directly
  if (require.main === module) {
    testWorker().then(() => {
      process.exit(0);
    }).catch((error) => {
      console.error("❌ Test failed:", error);
      process.exit(1);
    });
  }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  window.testCloudflareWorker = testWorker;
  console.log("💡 Run testCloudflareWorker() in console to test the worker");
}

