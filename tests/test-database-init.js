#!/usr/bin/env node

/**
 * Test database initialization to reproduce the path error
 */

async function testDatabaseInit() {
  console.log("🧪 Testing Database Initialization");
  console.log("==================================\n");

  try {
    console.log("1. Importing database module...");
    const { willysDatabase } = await import("./lib/database.js");
    console.log("✅ Database module imported");

    console.log("2. Attempting to initialize database...");
    await willysDatabase.ensureInitialized();
    console.log("✅ Database initialized successfully");

    console.log("3. Testing database stats...");
    const stats = await willysDatabase.getStats();
    console.log("✅ Database stats retrieved:", stats);

    console.log("4. Testing smart search...");
    const results = await willysDatabase.smartSearchProducts("ost", 3);
    console.log("✅ Smart search completed, results:", results.length);
  } catch (error) {
    console.error("❌ Database initialization error:");
    console.error("Message:", error.message);
    console.error("Name:", error.name);
    console.error("Code:", error.code);
    console.error("Stack trace:");
    console.error(error.stack);

    // Check for the specific database path error
    if (
      error.message.includes("path") &&
      (error.message.includes("string") || error.message.includes("URL"))
    ) {
      console.log("\n🔍 This is the database path error!");
      console.log(
        "Error indicates better-sqlite3 is receiving wrong type for path parameter",
      );
    }
  }
}

testDatabaseInit();
