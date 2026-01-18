#!/usr/bin/env node

/**
 * Test that simulates exactly what happens in the Next.js server action
 */

async function simulateServerAction() {
  console.log("🔧 Simulating Next.js Server Action Environment");
  console.log("===============================================\n");

  try {
    console.log("1. Simulating server action context...");

    // Set environment to match Next.js server
    process.env.NODE_ENV = "development";
    process.env.NEXT_RUNTIME = "nodejs";

    console.log("   - NODE_ENV:", process.env.NODE_ENV);
    console.log("   - NEXT_RUNTIME:", process.env.NEXT_RUNTIME);

    console.log("\n2. Dynamic imports (as done in database.ts)...");

    // This mirrors the exact code in database.ts
    let Database;
    let sqliteVec;

    Database = (await import("better-sqlite3")).default;
    console.log("   ✅ Database imported");

    try {
      sqliteVec = await import("sqlite-vec-darwin-arm64");
      console.log("   ✅ sqlite-vec-darwin-arm64 imported");
    } catch (e) {
      console.log(
        "   - sqlite-vec-darwin-arm64 failed, trying generic:",
        e.message,
      );
      sqliteVec = await import("sqlite-vec");
      console.log("   ✅ sqlite-vec imported");
    }

    console.log("   - sqliteVec keys:", Object.keys(sqliteVec));
    console.log("   - load function type:", typeof sqliteVec.load);

    console.log("\n3. Creating database (as done in ensureInitialized)...");

    const path = require("node:path");
    const cwd = process.cwd();
    const DB_PATH = path.resolve(cwd, "test-willys-cache.db");
    const dbPathString = String(DB_PATH);

    console.log("   - DB path:", dbPathString);

    const db = new Database(dbPathString);
    console.log("   ✅ Database created");
    console.log("   - db type:", typeof db);
    console.log("   - db constructor:", db.constructor.name);

    console.log("\n4. Loading sqlite-vec (the critical moment)...");
    console.log("   - About to call sqliteVec.load(db)");
    console.log("   - db instance check:", typeof db.prepare === "function");

    // This is where the error happens in your app - mirror the new database.ts logic
    if (typeof sqliteVec.getLoadablePath === "function") {
      const extensionPath = sqliteVec.getLoadablePath();
      console.log("   - Loading sqlite-vec from path:", extensionPath);
      db.loadExtension(extensionPath);
    } else {
      // Fallback to direct load method
      sqliteVec.load(db);
    }

    console.log("   ✅ sqlite-vec loaded successfully!");

    // Test vector table creation
    console.log("\n5. Testing vector table creation...");
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS test_vectors USING vec0(
        product_code TEXT PRIMARY KEY,
        embedding float[1536]
      )
    `);
    console.log("   ✅ Vector table created");

    db.close();

    // Clean up test file
    const fs = require("node:fs");
    if (fs.existsSync(dbPathString)) {
      fs.unlinkSync(dbPathString);
      console.log("   🧹 Test database cleaned up");
    }

    console.log("\n🎉 Server action simulation successful!");
  } catch (error) {
    console.error("\n❌ Server action simulation failed!");
    console.error("Error:", error.message);
    console.error("Name:", error.name);
    console.error("Code:", error.code);

    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    // This should help us understand what's different
    console.error("\nDebugging info:");
    console.error("- Current working directory:", process.cwd());
    console.error("- __dirname:", __dirname);
    console.error("- Module paths:", module.paths);
  }
}

simulateServerAction();
