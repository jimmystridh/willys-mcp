#!/usr/bin/env node

/**
 * Direct test of smart search to see if the fallback works
 */

async function testSmartSearchDirect() {
  console.log("🧪 Testing Smart Search with sqlite-vec Fallback");
  console.log("================================================\n");

  try {
    // Direct test of database initialization with fallback
    console.log("1. Testing database initialization...");
    const { willysDatabase } = await import("./lib/database.js");
    await willysDatabase.ensureInitialized();
    console.log("✅ Database initialized successfully");

    console.log("2. Testing smart search (text-only fallback)...");
    const results = await willysDatabase.smartSearchProducts("ost", 3);
    console.log(`✅ Smart search returned ${results.length} results`);

    if (results.length > 0) {
      console.log("📦 First result:", results[0].name);
      console.log("📊 Score:", results[0].score);
    }

    console.log("3. Testing hybrid search...");
    const hybridResults = await willysDatabase.hybridSearchProducts("ost", 3);
    console.log(`✅ Hybrid search returned ${hybridResults.length} results`);

    if (hybridResults.length > 0) {
      console.log("📦 First hybrid result:", hybridResults[0].name);
      console.log("📊 Hybrid score:", hybridResults[0].score);
      console.log("🔍 Source:", hybridResults[0].source);
    }

    console.log("\n🎉 Smart search is working with fallback!");
  } catch (error) {
    console.error("❌ Smart search test failed:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
  }
}

testSmartSearchDirect();
