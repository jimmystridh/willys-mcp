#!/usr/bin/env node

/**
 * Minimal test to reproduce the database path type error
 */

async function testDatabasePath() {
  console.log("🧪 Minimal Database Path Test");
  console.log("============================\n");

  try {
    console.log("Testing path.join with process.cwd()...");
    const path = require("node:path");

    console.log("process.cwd():", process.cwd());
    console.log("typeof process.cwd():", typeof process.cwd());

    const dbPath = path.join(process.cwd(), "willys-cache.db");
    console.log("path.join result:", dbPath);
    console.log("typeof path.join result:", typeof dbPath);

    // Try to create Database with the path
    console.log("\nTesting better-sqlite3 with this path...");
    const Database = require("better-sqlite3");

    console.log("Creating database with path:", dbPath);
    const db = new Database(dbPath);
    console.log("✅ Database created successfully");

    // Try to load sqlite-vec
    console.log("\nTesting sqlite-vec loading...");
    const sqliteVec = require("sqlite-vec");
    sqliteVec.load(db);
    console.log("✅ sqlite-vec loaded successfully");

    db.close();
    console.log("✅ Database closed successfully");
  } catch (error) {
    console.error("❌ Error during database operations:");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Type:", typeof error);
    console.error("Stack:", error.stack?.split("\n").slice(0, 5));

    if (error.message.includes("path") && error.message.includes("URL")) {
      console.log("\n🔍 This appears to be the path URL error!");
      console.log(
        "The issue is that better-sqlite3 is receiving a URL object instead of a string",
      );
    }
  }
}

testDatabasePath();
