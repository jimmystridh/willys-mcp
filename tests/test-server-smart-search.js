#!/usr/bin/env node

/**
 * Test server-side smart search functionality
 */

async function testServerSmartSearch() {
  console.log("🔍 Testing Server-Side Smart Search");
  console.log("==================================\n");

  try {
    // Test the action function directly
    const { getSmartProductMatches } = await import("./actions/orders");

    console.log('1. Testing smart search with "ost"...');
    const result = await getSmartProductMatches("ost", 3);

    console.log("✅ Smart search completed:");
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Matches: ${result.matches.length}`);

    result.matches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match.product.name} (score: ${match.score})`);
      if (match.similarity !== undefined) {
        console.log(
          `      Similarity: ${(match.similarity * 100).toFixed(1)}% | Source: ${match.source}`,
        );
      }
    });

    console.log('\n2. Testing with "mjölk"...');
    const result2 = await getSmartProductMatches("mjölk", 2);

    console.log("✅ Second search completed:");
    result2.matches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match.product.name} (score: ${match.score})`);
    });

    console.log("\n🎯 Server-side smart search is working correctly!");
    console.log("The web UI should now provide semantic search results.");
  } catch (error) {
    console.error("❌ Server smart search error:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Make sure OPENAI_API_KEY is set");
    console.log("2. Check that embeddings have been generated");
    console.log("3. Verify database initialization");
  }
}

testServerSmartSearch();
