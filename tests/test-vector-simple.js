#!/usr/bin/env node

async function testVectorSearch() {
  console.log("🧪 Testing Vector Search...");

  try {
    const { willysDatabase } = require("./lib/database");

    console.log('Testing vector search for "ost" (cheese)...');
    const results = await willysDatabase.vectorSearchProducts("ost", 5);

    console.log(`✅ Found ${results.length} vector matches:`);
    results.forEach((result, i) => {
      console.log(
        `  ${i + 1}. ${result.name} (similarity: ${(result.similarity * 100).toFixed(1)}%)`,
      );
    });

    console.log("\nTesting hybrid search...");
    const hybridResults = await willysDatabase.hybridSearchProducts("ost", 3);

    console.log(`✅ Found ${hybridResults.length} hybrid matches:`);
    hybridResults.forEach((result, i) => {
      console.log(
        `  ${i + 1}. ${result.name} (score: ${result.score.toFixed(1)}, source: ${result.source})`,
      );
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testVectorSearch();
