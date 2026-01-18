#!/usr/bin/env node

/**
 * Simple test to check better-sqlite3 path handling
 */

async function testSqlitePath() {
  console.log("🧪 Testing better-sqlite3 Path Handling");
  console.log("======================================\n");

  try {
    const path = require("node:path");

    // Test 1: Check process.cwd() type
    console.log("1. Checking process.cwd()...");
    const cwd = process.cwd();
    console.log("process.cwd():", cwd);
    console.log("typeof process.cwd():", typeof cwd);
    console.log("process.cwd() instanceof String:", cwd instanceof String);
    console.log("process.cwd() constructor:", cwd.constructor.name);

    // Test 2: Check path.resolve result
    console.log("\n2. Testing path.resolve...");
    const dbPath = path.resolve(cwd, "test.db");
    console.log("path.resolve result:", dbPath);
    console.log("typeof path.resolve result:", typeof dbPath);
    console.log("dbPath instanceof String:", dbPath instanceof String);
    console.log("dbPath constructor:", dbPath.constructor.name);

    // Test 3: Force string conversion
    console.log("\n3. Testing string conversion...");
    const dbPathString = String(dbPath);
    console.log("String(dbPath):", dbPathString);
    console.log("typeof String(dbPath):", typeof dbPathString);

    // Test 4: Try to create Database with different path types
    console.log("\n4. Testing better-sqlite3 with different path types...");
    const Database = require("better-sqlite3");

    console.log("Trying with original path...");
    try {
      const db1 = new Database(dbPath);
      console.log("✅ Original path worked");
      db1.close();
    } catch (err) {
      console.error("❌ Original path failed:", err.message);
    }

    console.log("Trying with string-converted path...");
    try {
      const db2 = new Database(dbPathString);
      console.log("✅ String-converted path worked");
      db2.close();
    } catch (err) {
      console.error("❌ String-converted path failed:", err.message);
    }

    console.log("Trying with template literal...");
    try {
      const db3 = new Database(`${dbPath}`);
      console.log("✅ Template literal path worked");
      db3.close();
    } catch (err) {
      console.error("❌ Template literal path failed:", err.message);
    }
  } catch (error) {
    console.error("❌ Test error:");
    console.error("Message:", error.message);
    console.error("Name:", error.name);
    console.error("Stack:", error.stack);
  }

  // Clean up test file
  try {
    require("node:fs").unlinkSync("test.db");
  } catch (_e) {
    // Ignore cleanup errors
  }
}

testSqlitePath();
