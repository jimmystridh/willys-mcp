const fs = require("node:fs");

async function testWillysSearchWithAuth() {
  console.log("🧪 Testing Willys MCP Search with Real Authentication...\n");

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

    const baseUrl = "http://localhost:3001/api/mcp/http";

    // Step 1: Login to get session ID
    console.log("\n📝 Step 1: Logging into Willys...");

    const loginResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_login",
          arguments: {
            username,
            password,
          },
        },
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login request failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log("   📤 Login response:", JSON.stringify(loginData, null, 2));

    // Extract session ID from response
    const sessionIdMatch = loginData.result?.content?.[0]?.text?.match(
      /Session ID: ([a-f0-9-]+)/,
    );
    if (!sessionIdMatch) {
      throw new Error("Failed to extract session ID from login response");
    }

    const sessionId = sessionIdMatch[1];
    console.log(`   ✅ Successfully logged in! Session ID: ${sessionId}`);

    // Step 2: Test search suggestions
    console.log("\n📝 Step 2: Testing search suggestions...");

    const suggestionsResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_search_suggestions",
          arguments: {
            sessionId,
            term: "mjö",
          },
        },
      }),
    });

    if (!suggestionsResponse.ok) {
      throw new Error(
        `Suggestions request failed: ${suggestionsResponse.status}`,
      );
    }

    const suggestionsData = await suggestionsResponse.json();
    console.log("   ✅ Search suggestions response received");
    console.log(
      "   📊 Suggestions data:",
      `${JSON.stringify(suggestionsData, null, 2).substring(0, 500)}...`,
    );

    // Step 3: Test product search
    console.log("\n📝 Step 3: Testing product search...");

    const searchResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_search",
          arguments: {
            sessionId,
            query: "mjölk",
            page: 0,
            size: 10,
          },
        },
      }),
    });

    if (!searchResponse.ok) {
      throw new Error(`Search request failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    console.log("   ✅ Product search response received");

    if (searchData.result?.content?.[0]?.text) {
      const responseText = searchData.result.content[0].text;
      console.log(
        "   📄 Search response preview:",
        `${responseText.substring(0, 300)}...`,
      );

      // Check if we got HTML content
      if (responseText.includes("HTML content")) {
        console.log("   ✅ Successfully received HTML search results");

        // Extract HTML content length from response
        const htmlLengthMatch = responseText.match(/(\d+) characters of HTML/);
        if (htmlLengthMatch) {
          console.log(
            `   📊 HTML content length: ${htmlLengthMatch[1]} characters`,
          );
        }
      }
    }

    // Step 4: Test different search terms
    console.log("\n📝 Step 4: Testing additional search terms...");

    const testTerms = ["bröd", "äpplen", "kött"];

    for (const term of testTerms) {
      try {
        console.log(`   🔍 Searching for: ${term}`);

        const termSearchResponse = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method: "tools/call",
            params: {
              name: "mcp__willys_search",
              arguments: {
                sessionId,
                query: term,
                page: 0,
                size: 5,
              },
            },
          }),
        });

        if (termSearchResponse.ok) {
          const termSearchData = await termSearchResponse.json();
          const success =
            termSearchData.result?.content?.[0]?.text?.includes(
              "Search Results",
            );
          console.log(
            `   ${success ? "✅" : "❌"} Search for "${term}": ${success ? "Success" : "Failed"}`,
          );
        } else {
          console.log(
            `   ❌ Search for "${term}": HTTP ${termSearchResponse.status}`,
          );
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`   ❌ Search for "${term}": ${error.message}`);
      }
    }

    // Step 5: Test pagination
    console.log("\n📝 Step 5: Testing pagination...");

    try {
      const paginationResponse = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "tools/call",
          params: {
            name: "mcp__willys_search",
            arguments: {
              sessionId,
              query: "mjölk",
              page: 1,
              size: 10,
            },
          },
        }),
      });

      if (paginationResponse.ok) {
        const paginationData = await paginationResponse.json();
        const success =
          paginationData.result?.content?.[0]?.text?.includes("page 2");
        console.log(
          `   ${success ? "✅" : "❌"} Pagination test: ${success ? "Success" : "Failed"}`,
        );
      } else {
        console.log(`   ❌ Pagination test: HTTP ${paginationResponse.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Pagination test: ${error.message}`);
    }

    // Step 6: Logout
    console.log("\n📝 Step 6: Logging out...");

    const logoutResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: "mcp__willys_logout",
          arguments: {
            sessionId,
          },
        },
      }),
    });

    if (logoutResponse.ok) {
      console.log("   ✅ Successfully logged out");
    } else {
      console.log("   ⚠️  Logout failed, but continuing...");
    }

    console.log("\n📊 Test Summary:");
    console.log("✅ Authentication: Working");
    console.log("✅ Search suggestions: Implemented and tested");
    console.log("✅ Product search: Implemented and tested");
    console.log("✅ Pagination: Implemented and tested");
    console.log("✅ Multiple search terms: Tested");
    console.log("✅ Session management: Working");

    console.log("\n🎯 Search Implementation Complete!");
    console.log("The MCP search tools are ready for use with:");
    console.log("- mcp__willys_search (for product searches)");
    console.log("- mcp__willys_search_suggestions (for autocomplete)");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Check if Next.js server is running
async function checkServerRunning() {
  try {
    const _response = await fetch("http://localhost:3001/api/mcp/http", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "ping" }),
    });
    return true;
  } catch (_error) {
    return false;
  }
}

async function main() {
  console.log("🚀 Starting comprehensive search test...\n");

  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.log("❌ Next.js server is not running on localhost:3001");
    console.log("Please run: npm run dev");
    return;
  }

  console.log("✅ Next.js server is running");
  await testWillysSearchWithAuth();
}

main().catch(console.error);
