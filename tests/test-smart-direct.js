// Direct test of the smart product matching algorithm
// This bypasses the server action and tests the core function

const fs = require("node:fs");
const path = require("node:path");

// We need to simulate the environment that the mcp-orders file expects
process.env.NODE_ENV = "development";

async function testDirectSmartMatches() {
  console.log("Testing smart product matching algorithm directly...");

  try {
    // First we need to check if we have credentials
    const credentialsPath = path.join(process.cwd(), ".credentials");
    if (!fs.existsSync(credentialsPath)) {
      console.log("❌ No .credentials file found. Please login first.");
      return;
    }

    const credentialsContent = fs
      .readFileSync(credentialsPath, "utf8")
      .trim()
      .split("\n");
    const credentials = {
      username: credentialsContent[0],
      password: credentialsContent[1],
    };
    console.log("✅ Found credentials for:", credentials.username);

    // Import the function dynamically to handle ES modules
    const { mcpGetSmartProductMatches } = await import("./lib/mcp-orders.js");

    // Test with cookie string (what the server action actually passes)
    // We'll simulate what getWillysCookies() returns - this should be a cookie string
    const sessionId = "test-cookie-string";
    const result = await mcpGetSmartProductMatches(sessionId, "mjölk", 3);

    console.log("\nResult:");
    console.log(result);

    if (result.includes("Smart matches for")) {
      console.log("\n✅ Success! Found smart matches in result");
    } else if (result.includes("No matches found")) {
      console.log(
        "\n⚠️  No matches found - this might be expected if no purchase history",
      );
    } else {
      console.log("\n❓ Unexpected result format");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
}

// Run the test
testDirectSmartMatches();
