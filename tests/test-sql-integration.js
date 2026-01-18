#!/usr/bin/env node

/**
 * Integration test for SQL-based search functions
 */

const { willysDatabase } = require("./lib/database");

async function testSQLIntegration() {
  console.log("Testing SQL-based search integration...\n");

  // Get database stats
  const stats = willysDatabase.getStats();
  console.log("Database Statistics:");
  console.log(`- Products: ${stats.products}`);
  console.log(`- Categories: ${stats.categories}`);
  console.log(`- Relational orders: ${stats.relationalOrders}`);
  console.log("");

  if (stats.products === 0) {
    console.log("⚠️  No products in database. Testing with empty database...\n");
  }

  // Test 1: Smart search
  console.log("Test 1: Smart Search");
  const smartResults = willysDatabase.smartSearchProducts("mjölk", 3);
  console.log(`  Found ${smartResults.length} results`);
  smartResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name} (${result.productCode})`);
    console.log(
      `     Score: ${result.score}, Frequency: ${result.frequency}, Recent: ${result.recentPurchases}`,
    );
  });
  console.log("");

  // Test 2: Basic SQL search
  console.log("Test 2: Basic SQL Search");
  const basicResults = willysDatabase.searchProductsSQL("bröd", 3);
  console.log(`  Found ${basicResults.length} results`);
  basicResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name} (${result.productCode})`);
    console.log(
      `     Frequency: ${result.frequency}, Last: ${new Date(result.lastPurchased).toLocaleDateString()}`,
    );
  });
  console.log("");

  // Test 3: Frequent products
  console.log("Test 3: Most Frequent Products");
  const frequentResults = willysDatabase.getFrequentProducts(5);
  console.log(`  Found ${frequentResults.length} results`);
  frequentResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name} (${result.productCode})`);
    console.log(
      `     Frequency: ${result.frequency}, Last: ${new Date(result.lastPurchased).toLocaleDateString()}`,
    );
  });
  console.log("");

  // Test 4: Category search
  console.log("Test 4: Search by Category");
  const categoryResults = willysDatabase.searchProductsByCategory("mejeri", 3);
  console.log(`  Found ${categoryResults.length} results in dairy category`);
  categoryResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name} (${result.productCode})`);
    console.log(`     Frequency: ${result.frequency}`);
  });
  console.log("");

  // Test 5: Migration check
  console.log("Test 5: Migration Status");
  const needsMigration = willysDatabase.needsMigration();
  console.log(`  Needs migration: ${needsMigration}`);
  if (needsMigration) {
    console.log("  Running migration...");
    const migrationResult = willysDatabase.migrateExistingCacheToRelational();
    console.log(
      `  Migration result: ${migrationResult.migrated} orders, ${migrationResult.errors} errors`,
    );
  }
  console.log("");

  // Test 6: Edge cases
  console.log("Test 6: Edge Cases");
  console.log("  Empty search term:");
  const emptyResults = willysDatabase.smartSearchProducts("", 3);
  console.log(`    Results: ${emptyResults.length}`);

  console.log("  Very long search term:");
  const longResults = willysDatabase.smartSearchProducts(
    "this_is_a_very_long_search_term_that_probably_wont_match_anything",
    3,
  );
  console.log(`    Results: ${longResults.length}`);

  console.log("  Special characters:");
  const specialResults = willysDatabase.smartSearchProducts(
    "mjölk & äpplen",
    3,
  );
  console.log(`    Results: ${specialResults.length}`);
  console.log("");

  console.log("✅ SQL integration test completed!");
}

// Check if migration is needed and run it
if (willysDatabase.needsMigration()) {
  console.log("Running migration first...");
  const result = willysDatabase.migrateExistingCacheToRelational();
  console.log(
    `Migration completed: ${result.migrated} orders, ${result.errors} errors\n`,
  );
}

testSQLIntegration().catch(console.error);
