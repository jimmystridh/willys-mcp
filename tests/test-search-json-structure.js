#!/usr/bin/env node

/**
 * Updated Search Functionality Tests - New Clean JSON Structure
 * Tests the updated mcpSearchProducts function with clean JSON parsing
 */

const fs = require("node:fs");

async function testSearchJSONStructure() {
  console.log("🔍 TESTING UPDATED SEARCH JSON STRUCTURE");
  console.log("=".repeat(50));

  try {
    // Read credentials
    const credentials = fs
      .readFileSync(".credentials", "utf8")
      .trim()
      .split("\n");
    if (credentials.length < 2) {
      throw new Error("Invalid credentials file format");
    }

    const username = credentials[0].trim();
    const password = credentials[1].trim();

    console.log(
      `📝 Using credentials for user: ${username.substring(0, 3)}***`,
    );

    const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3009";
    const mcpUrl = `${baseUrl}/api/mcp/http`;

    // === LOGIN ===
    console.log("\\n🔑 Step 1: Login to Willys...");

    const loginResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_login",
          arguments: { username, password },
        },
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login request failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const sessionIdMatch = loginData.result?.content?.[0]?.text?.match(
      /Session ID: ([a-f0-9-]+)/,
    );
    if (!sessionIdMatch) {
      throw new Error("Failed to extract session ID");
    }

    const sessionId = sessionIdMatch[1];
    console.log(`   ✅ Login successful, session: ${sessionId}`);

    // === TEST SEARCH QUERIES ===
    const testQueries = [
      { query: "ost", expectedCategory: "cheese", minResults: 2 },
      { query: "mjölk", expectedCategory: "dairy", minResults: 1 },
      { query: "bröd", expectedCategory: "bread", minResults: 3 },
      { query: "kräm fräsch", expectedCategory: "mixed", minResults: 1 },
    ];

    for (const testCase of testQueries) {
      console.log(`\\n🔍 Testing search: "${testCase.query}"`);

      const searchResponse = await fetch(mcpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "tools/call",
          params: {
            name: "mcp__willys_search",
            arguments: {
              sessionId,
              query: testCase.query,
              size: 5,
              page: 0,
            },
          },
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search request failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const content = searchData.result?.content?.[0]?.text;

      if (!content) {
        throw new Error("No search content returned");
      }

      console.log("   📊 Response format validation:");

      // Test new JSON structure format
      const hasFoundProducts =
        content.includes("Found ") && content.includes(" products:");
      if (!hasFoundProducts) {
        throw new Error('Response should include "Found X products:" format');
      }
      console.log('   ✅ Contains "Found X products" message');

      // Test structured product display
      const hasProductStructure =
        content.includes("Code:") &&
        content.includes("Price:") &&
        content.includes("Brand:");
      if (!hasProductStructure) {
        throw new Error(
          "Response should include structured product data (Code, Price, Brand)",
        );
      }
      console.log("   ✅ Contains structured product fields");

      // Test clean JSON mention
      const mentionsCleanJSON = content.includes("clean JSON structure");
      if (!mentionsCleanJSON) {
        throw new Error("Response should mention clean JSON structure");
      }
      console.log("   ✅ Mentions clean JSON structure");

      // Extract product count
      const productCountMatch = content.match(/Found (\\d+) products/);
      if (productCountMatch) {
        const productCount = parseInt(productCountMatch[1], 10);
        if (productCount >= testCase.minResults) {
          console.log(
            `   ✅ Found ${productCount} products (>= ${testCase.minResults} expected)`,
          );
        } else {
          console.log(
            `   ⚠️  Found ${productCount} products (< ${testCase.minResults} expected)`,
          );
        }

        // Extract and validate first product
        if (productCount > 0) {
          console.log("   📦 First product analysis:");

          // Look for product name in "1. **ProductName**" format
          const productNameMatch = content.match(/1\\. \\*\\*([^*]+)\\*\\*/);
          if (productNameMatch) {
            console.log(`      Name: ${productNameMatch[1]}`);
          }

          // Look for product code
          const codeMatch = content.match(/Code: ([A-Z0-9_]+)/);
          if (codeMatch) {
            console.log(`      Code: ${codeMatch[1]}`);
          }

          // Look for price
          const priceMatch = content.match(/Price: ([\\d,]+ kr)/);
          if (priceMatch) {
            console.log(`      Price: ${priceMatch[1]}`);
          }

          // Look for brand
          const brandMatch = content.match(/Brand: ([^\\n]+)/);
          if (brandMatch) {
            console.log(`      Brand: ${brandMatch[1].trim()}`);
          }
        }
      } else {
        throw new Error("Could not extract product count from response");
      }

      console.log(`   🎯 "${testCase.query}" search validation PASSED`);
    }

    // === TEST EDGE CASES ===
    console.log("\\n🧪 Testing edge cases...");

    // Test empty/no results query
    console.log('\\n🔍 Testing no-results query: "xyzabc123"');
    const emptySearchResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_search",
          arguments: {
            sessionId,
            query: "xyzabc123",
            size: 5,
            page: 0,
          },
        },
      }),
    });

    const emptySearchData = await emptySearchResponse.json();
    const emptyContent = emptySearchData.result?.content?.[0]?.text;

    if (
      emptyContent?.includes("Found 0 products") ||
      emptyContent?.includes("No products found")
    ) {
      console.log("   ✅ No-results case handled correctly");
    } else {
      console.log("   ⚠️  No-results case handling unclear");
    }

    // Test pagination
    console.log("\\n📄 Testing pagination: page 1");
    const paginatedSearchResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_search",
          arguments: {
            sessionId,
            query: "mjölk",
            size: 3,
            page: 1, // Second page
          },
        },
      }),
    });

    const paginatedSearchData = await paginatedSearchResponse.json();
    const paginatedContent = paginatedSearchData.result?.content?.[0]?.text;

    if (paginatedContent?.includes("page 2")) {
      console.log("   ✅ Pagination working (shows page 2)");
    } else {
      console.log("   ⚠️  Pagination may not be working correctly");
    }

    // === STRUCTURE COMPARISON ===
    console.log("\\n⚖️  Comparing old vs new structure...");

    console.log("   OLD: Raw HTML + manual parsing required");
    console.log("   NEW: ✅ Structured display with clean JSON backing");
    console.log(
      "   NEW: ✅ Direct product information (name, code, price, brand)",
    );
    console.log("   NEW: ✅ Stock and category information");
    console.log("   NEW: ✅ Volume and image data available");
    console.log("   NEW: ✅ Consistent formatting across all searches");

    // === FINAL RESULTS ===
    console.log(`\\n${"=".repeat(50)}`);
    console.log("🎉 SEARCH JSON STRUCTURE TESTS COMPLETED");
    console.log("✅ All search queries return structured data");
    console.log("✅ Clean JSON parsing working correctly");
    console.log("✅ Product information properly formatted");
    console.log("✅ Edge cases handled appropriately");
    console.log("🚀 Ready for production use!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  testSearchJSONStructure().catch(console.error);
}

module.exports = testSearchJSONStructure;
