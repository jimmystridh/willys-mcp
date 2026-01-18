#!/usr/bin/env node

/**
 * Direct test to reproduce the smart search database path error
 */

async function testDirectSmartSearch() {
  console.log("🧪 Testing Direct Smart Search to Reproduce Database Error");
  console.log("========================================================\n");

  try {
    // Test 1: Direct database import (should work in Node.js)
    console.log("1. Testing direct database import in Node.js...");
    const { willysDatabase } = await import("./lib/database.js");
    console.log("✅ Database imported successfully");

    // Test 2: Check stats to trigger initialization
    console.log("2. Getting database stats (triggers initialization)...");
    const stats = await willysDatabase.getStats();
    console.log("✅ Database stats:", stats);

    // Test 3: Try smart search directly
    console.log("3. Testing smart search directly...");
    const results = await willysDatabase.smartSearchProducts("ost", 3);
    console.log("✅ Smart search results:", results.length);

    console.log("\n🎯 Direct database access works fine in Node.js");
  } catch (error) {
    console.error("❌ Direct database error:", error.message);
    console.error("Stack:", error.stack);
  }

  try {
    // Test 4: Try to import and call the server action directly
    console.log("\n4. Testing server action import (simulating Next.js)...");

    // This might trigger the path error if it happens during import
    const { getSmartProductMatches } = await import("./actions/orders.js");
    console.log("✅ Server actions imported successfully");

    console.log("5. Calling getSmartProductMatches server action...");
    const result = await getSmartProductMatches("ost", 3);

    console.log("✅ Server action result:", {
      success: result.success,
      matchCount: result.matches.length,
      message: result.message,
    });

    if (result.matches.length > 0) {
      console.log("📦 Sample match:", result.matches[0].product.name);
    }
  } catch (error) {
    console.error("❌ Server action error:", error.message);
    console.error("Error code:", error.code);
    console.error("Stack trace:");
    console.error(error.stack);

    if (error.message.includes("path") && error.message.includes("string")) {
      console.log("\n🔍 This is likely the database path error you reported!");
      console.log(
        "The error occurs when the server action tries to initialize the database.",
      );
    }
  }
}

testDirectSmartSearch();
