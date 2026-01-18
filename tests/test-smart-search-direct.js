#!/usr/bin/env node

/**
 * Direct test of smart search functionality
 */

async function testSmartSearchDirect() {
  console.log("🧪 Direct Smart Search Test");
  console.log("===========================\n");

  try {
    // Import the database
    const { willysDatabase } = await import("./lib/database.ts");

    console.log("📊 Testing database connection...");
    await willysDatabase.ensureInitialized();
    console.log("✅ Database initialized successfully");

    // Test search term
    const searchTerm = "ost";
    console.log(`\n🔍 Testing hybrid search for "${searchTerm}"...`);

    const results = await willysDatabase.hybridSearchProducts(searchTerm, 5);
    console.log(`📋 Found ${results.length} results:`);

    if (results.length > 0) {
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} (${result.productCode})`);
        console.log(
          `     Similarity: ${result.similarity.toFixed(3)}, Frequency: ${result.frequency}, Score: ${result.score.toFixed(3)}`,
        );
        console.log(
          `     Source: ${result.source}, Manufacturer: ${result.manufacturer || "N/A"}`,
        );
      });
    } else {
      console.log("  No results found");
    }

    // Also test pure vector search
    console.log(`\n🎯 Testing pure vector search for "${searchTerm}"...`);
    const vectorResults = await willysDatabase.vectorSearchProducts(
      searchTerm,
      5,
    );
    console.log(`📋 Found ${vectorResults.length} vector results:`);

    if (vectorResults.length > 0) {
      vectorResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} (${result.productCode})`);
        console.log(
          `     Similarity: ${result.similarity.toFixed(3)}, Manufacturer: ${result.manufacturer || "N/A"}`,
        );
      });
    } else {
      console.log("  No vector results found");
    }

    // Check if we have products with embeddings
    console.log("\n📈 Checking product statistics...");
    const stats = await willysDatabase.getProductStats();
    console.log(`Total products: ${stats.totalProducts}`);
    console.log(`Products with embeddings: ${stats.productsWithEmbeddings}`);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

testSmartSearchDirect();
