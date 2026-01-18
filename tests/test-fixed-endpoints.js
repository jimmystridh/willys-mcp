#!/usr/bin/env node

/**
 * Test the fixed offers and customer info endpoints
 */

const fs = require("node:fs");

// Import the functions directly
const {
  mcpLogin,
  mcpGetOffers,
  mcpGetCustomerInfo,
} = require("./lib/mcp-orders.js");

async function testFixedEndpoints() {
  console.log("🧪 TESTING FIXED ENDPOINTS");
  console.log("=".repeat(50));

  let sessionId = null;

  try {
    // Load credentials
    if (!fs.existsSync(".credentials")) {
      console.log("❌ No .credentials file found");
      return false;
    }

    const [username, password] = fs
      .readFileSync(".credentials", "utf8")
      .trim()
      .split("\n");
    console.log("✅ Loaded credentials for", `${username.substring(0, 3)}***`);

    // Login first
    console.log("\n🔧 Testing login...");
    sessionId = await mcpLogin(username, password);

    if (!sessionId) {
      console.log("❌ Login failed");
      return false;
    }

    console.log(
      "✅ Login successful, sessionId:",
      `${sessionId.substring(0, 8)}...`,
    );

    // Test offers endpoint (previously broken with 304 error)
    console.log("\n🧪 Testing FIXED offers endpoint...");
    console.log("   (Previously failed with 304 Not Modified error)");

    try {
      const offers = await mcpGetOffers(sessionId);

      if (offers && offers.length > 0) {
        console.log("✅ OFFERS ENDPOINT FIXED!");
        console.log(`   Found ${offers.length} offers`);
        console.log(`   Sample: ${offers[0].name?.substring(0, 50)}...`);
      } else if (offers && offers.length === 0) {
        console.log("✅ OFFERS ENDPOINT WORKING (no current offers available)");
      } else {
        console.log("⚠️  OFFERS returned null/undefined");
      }
    } catch (error) {
      if (error.message.includes("304")) {
        console.log("❌ OFFERS STILL BROKEN - 304 error persists");
      } else {
        console.log("❌ OFFERS ERROR:", error.message.substring(0, 100));
      }
    }

    // Test customer info endpoint (previously broken with API endpoint issue)
    console.log("\n🧪 Testing FIXED customer info endpoint...");
    console.log("   (Previously failed with API endpoint issue)");

    try {
      const customerInfo = await mcpGetCustomerInfo(sessionId);

      if (
        customerInfo &&
        (customerInfo.name || customerInfo.email || customerInfo.uid)
      ) {
        console.log("✅ CUSTOMER INFO ENDPOINT FIXED!");
        console.log(`   Name: ${customerInfo.name || "N/A"}`);
        console.log(`   Email: ${customerInfo.email || "N/A"}`);
        console.log(`   UID: ${customerInfo.uid || "N/A"}`);
      } else {
        console.log("⚠️  CUSTOMER INFO returned empty data");
      }
    } catch (error) {
      if (
        error.message.includes("401") ||
        error.message.includes("customerinfo")
      ) {
        console.log("❌ CUSTOMER INFO STILL BROKEN - API error persists");
      } else {
        console.log("❌ CUSTOMER INFO ERROR:", error.message.substring(0, 100));
      }
    }

    console.log("\n🎉 ENDPOINT FIX VERIFICATION COMPLETED");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    return false;
  }

  return true;
}

// Run the test
if (require.main === module) {
  testFixedEndpoints()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { testFixedEndpoints };
