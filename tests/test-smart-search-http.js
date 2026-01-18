#!/usr/bin/env node

/**
 * Test smart search via HTTP to reproduce database error
 */

async function testSmartSearchHttp() {
  console.log("🧪 Testing Smart Search via HTTP Request");
  console.log("========================================\n");

  try {
    // Test direct HTTP request to trigger smart search server action
    console.log("1. Making HTTP request to smart search endpoint...");

    const response = await fetch("http://localhost:3009/api/smart-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchTerm: "ost",
        maxResults: 3,
      }),
    });

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      console.log("❌ Request failed with status:", response.status);
      const errorText = await response.text();
      console.log("Error response:", errorText);
      return;
    }

    const result = await response.json();
    console.log("✅ Smart search completed successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("❌ HTTP request error:");
    console.error("Message:", error.message);
    console.error("Name:", error.name);
    console.error("Stack:", error.stack);
  }
}

// Check if server is running first
async function checkServerRunning() {
  try {
    const response = await fetch("http://localhost:3009");
    return response.status < 500; // Accept any non-server-error status
  } catch (_error) {
    return false;
  }
}

async function main() {
  const isRunning = await checkServerRunning();
  if (!isRunning) {
    console.log("❌ Server not running on http://localhost:3009");
    console.log("Please run: PORT=3009 npm run dev");
    return;
  }

  console.log("✅ Server is running on http://localhost:3009");
  await testSmartSearchHttp();
}

main();
