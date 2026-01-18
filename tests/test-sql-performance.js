#!/usr/bin/env node

/**
 * Performance benchmarking for SQL-based vs JavaScript-based smart search
 */

const { willysDatabase } = require("./lib/database");

async function benchmarkSearchPerformance() {
  console.log("Starting performance benchmarking...\n");

  // Get database stats
  const stats = willysDatabase.getStats();
  console.log("Database Statistics:");
  console.log(`- Active sessions: ${stats.sessions}`);
  console.log(`- Legacy cached orders: ${stats.cachedOrders}`);
  console.log(`- Relational orders: ${stats.relationalOrders}`);
  console.log(`- Products: ${stats.products}`);
  console.log(`- Categories: ${stats.categories}`);
  console.log("");

  if (stats.products === 0) {
    console.log(
      "⚠️  No products in database. Run some order fetches first to populate data.",
    );
    return;
  }

  const searchTerms = ["mjölk", "bröd", "äpplen", "kött", "ost"];
  const iterations = 10;

  console.log(`Running ${iterations} iterations for each search term...\n`);

  for (const searchTerm of searchTerms) {
    console.log(`Benchmarking search for: "${searchTerm}"`);

    // Benchmark SQL search
    const sqlTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const _sqlResults = willysDatabase.smartSearchProducts(searchTerm, 5);
      const end = performance.now();
      sqlTimes.push(end - start);
    }

    const avgSqlTime = sqlTimes.reduce((a, b) => a + b, 0) / sqlTimes.length;
    const minSqlTime = Math.min(...sqlTimes);
    const maxSqlTime = Math.max(...sqlTimes);

    console.log(`  SQL Search:`);
    console.log(
      `    Results: ${willysDatabase.smartSearchProducts(searchTerm, 5).length} matches`,
    );
    console.log(`    Average time: ${avgSqlTime.toFixed(3)}ms`);
    console.log(`    Min time: ${minSqlTime.toFixed(3)}ms`);
    console.log(`    Max time: ${maxSqlTime.toFixed(3)}ms`);
    console.log("");
  }

  // Test different search functions
  console.log("Testing different search functions:");

  const testTerm = "mjölk";
  const testIterations = 100;

  // Test smartSearchProducts
  const smartTimes = [];
  for (let i = 0; i < testIterations; i++) {
    const start = performance.now();
    willysDatabase.smartSearchProducts(testTerm, 5);
    const end = performance.now();
    smartTimes.push(end - start);
  }
  const avgSmartTime =
    smartTimes.reduce((a, b) => a + b, 0) / smartTimes.length;

  // Test searchProductsSQL
  const basicTimes = [];
  for (let i = 0; i < testIterations; i++) {
    const start = performance.now();
    willysDatabase.searchProductsSQL(testTerm, 5);
    const end = performance.now();
    basicTimes.push(end - start);
  }
  const avgBasicTime =
    basicTimes.reduce((a, b) => a + b, 0) / basicTimes.length;

  // Test getFrequentProducts
  const frequentTimes = [];
  for (let i = 0; i < testIterations; i++) {
    const start = performance.now();
    willysDatabase.getFrequentProducts(10);
    const end = performance.now();
    frequentTimes.push(end - start);
  }
  const avgFrequentTime =
    frequentTimes.reduce((a, b) => a + b, 0) / frequentTimes.length;

  console.log(
    `  Smart Search (${testIterations} iterations): ${avgSmartTime.toFixed(3)}ms avg`,
  );
  console.log(
    `  Basic SQL Search (${testIterations} iterations): ${avgBasicTime.toFixed(3)}ms avg`,
  );
  console.log(
    `  Frequent Products (${testIterations} iterations): ${avgFrequentTime.toFixed(3)}ms avg`,
  );
  console.log("");

  // Test search result quality
  console.log("Search result quality comparison:");
  for (const term of searchTerms.slice(0, 3)) {
    const smartResults = willysDatabase.smartSearchProducts(term, 5);
    const basicResults = willysDatabase.searchProductsSQL(term, 5);

    console.log(`  "${term}":`);
    console.log(
      `    Smart search: ${smartResults.length} results, top score: ${smartResults[0]?.score || 0}`,
    );
    console.log(
      `    Basic search: ${basicResults.length} results, top frequency: ${basicResults[0]?.frequency || 0}`,
    );
    console.log("");
  }

  console.log("✅ Performance benchmarking completed!");
}

// Check if migration is needed
if (willysDatabase.needsMigration()) {
  console.log("Running migration first...");
  const result = willysDatabase.migrateExistingCacheToRelational();
  console.log(
    `Migration completed: ${result.migrated} orders, ${result.errors} errors\n`,
  );
}

benchmarkSearchPerformance().catch(console.error);
