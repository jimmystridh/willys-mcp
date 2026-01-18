#!/usr/bin/env node

/**
 * Direct test to reproduce the smart search database path error
 */

async function testDirectSmartSearch() {
  console.log("🧪 Testing Direct Smart Search Server Action");
  console.log("==========================================\n");

  try {
    console.log("1. Importing server action...");
    const { getSmartProductMatches } = await import("./actions/orders.ts");
    console.log("✅ Server action imported successfully");

    console.log('2. Calling getSmartProductMatches with "ost"...');
    const result = await getSmartProductMatches("ost", 3);

    console.log("✅ Smart search completed successfully!");
    console.log("Result:", {
      success: result.success,
      matchCount: result.matches?.length || 0,
      message: result.message,
    });

    if (result.matches && result.matches.length > 0) {
      console.log("📦 First match:", result.matches[0].product.name);
    }
  } catch (error) {
    console.error("❌ Direct smart search error:");
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

      // Try to get more details about the path being passed
      if (error.stack) {
        const pathLine = error.stack
          .split("\n")
          .find((line) => line.includes("Database") || line.includes("path"));
        if (pathLine) {
          console.log("Error location:", pathLine);
        }
      }
    }
  }
}

testDirectSmartSearch();
