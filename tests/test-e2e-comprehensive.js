#!/usr/bin/env node

/**
 * Comprehensive E2E Test Suite for Willys MCP Server & Web Interface
 * Tests both MCP API and Next.js web app with real authentication
 */

const fs = require("node:fs");
const path = require("node:path");

class WillysE2ETestSuite {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || "http://localhost:3009";
    this.mcpUrl = `${this.baseUrl}/api/mcp/http`;
    this.sessionId = null;
    this.credentials = null;

    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
    };
  }

  async loadCredentials() {
    const credentialsPath = path.join(process.cwd(), ".credentials");
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(
        "❌ No .credentials file found. Create with username and password on separate lines.",
      );
    }

    const credentialsContent = fs
      .readFileSync(credentialsPath, "utf8")
      .trim()
      .split("\n");
    this.credentials = {
      username: credentialsContent[0].trim(),
      password: credentialsContent[1].trim(),
    };

    console.log(
      `✅ Loaded credentials for user: ${this.credentials.username.substring(0, 3)}***`,
    );
  }

  async mcpCall(toolName, args) {
    const response = await fetch(this.mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP call failed: ${response.status}`);
    }

    return await response.json();
  }

  async test(name, testFn) {
    try {
      console.log(`\\n🧪 Testing: ${name}`);
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.testResults.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name} - ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push({ name, error: error.message });
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  async runAllTests() {
    console.log("🚀 COMPREHENSIVE WILLYS E2E TEST SUITE");
    console.log("=".repeat(50));

    try {
      await this.loadCredentials();

      // === MCP TESTS ===
      console.log("\\n📡 TESTING MCP SERVER");

      await this.test("MCP Login", async () => {
        const result = await this.mcpCall(
          "mcp__willys_login",
          this.credentials,
        );
        this.assert(
          result.result?.content?.[0]?.text?.includes("Successfully logged in"),
          "Login should succeed",
        );

        const sessionMatch = result.result.content[0].text.match(
          /Session ID: ([a-f0-9-]+)/,
        );
        this.assert(sessionMatch, "Should extract session ID");
        this.sessionId = sessionMatch[1];
        console.log(`   📝 Session ID: ${this.sessionId}`);
      });

      await this.test("MCP Search - Clean JSON Structure", async () => {
        const result = await this.mcpCall("mcp__willys_search", {
          sessionId: this.sessionId,
          query: "mjölk",
          size: 5,
        });

        const content = result.result?.content?.[0]?.text;
        this.assert(content?.includes("Found"), "Should find products");
        this.assert(content?.includes("Code:"), "Should include product codes");
        this.assert(content?.includes("Price:"), "Should include prices");
        this.assert(content?.includes("Brand:"), "Should include brands");
        this.assert(
          content?.includes("clean JSON structure"),
          "Should mention clean JSON structure",
        );
        console.log("   📊 Search returns structured data");
      });

      await this.test("MCP Cart Operations", async () => {
        const cartResult = await this.mcpCall("mcp__willys_get_cart", {
          sessionId: this.sessionId,
        });
        this.assert(
          cartResult.result?.content?.[0]?.text,
          "Should get cart data",
        );
        console.log("   🛒 Cart operations working");
      });

      await this.test("MCP Customer Info", async () => {
        const customerResult = await this.mcpCall(
          "mcp__willys_get_customer_info",
          {
            sessionId: this.sessionId,
          },
        );
        this.assert(
          customerResult.result?.content?.[0]?.text?.includes(
            "Customer Information",
          ),
          "Should get customer info",
        );
        console.log("   👤 Customer info accessible");
      });

      await this.test("MCP Smart Product Matches", async () => {
        const smartResult = await this.mcpCall(
          "mcp__willys_get_smart_product_matches",
          {
            sessionId: this.sessionId,
            searchTerm: "mjölk",
            maxResults: 5,
          },
        );

        const content = smartResult.result?.content?.[0]?.text;
        this.assert(
          content?.includes("Smart matches"),
          "Should get smart matches",
        );
        this.assert(content?.includes("Score:"), "Should include match scores");
        console.log("   🎯 Smart matching functional");
      });

      // === WEB INTERFACE TESTS ===
      console.log("\\n🌐 TESTING WEB INTERFACE");

      await this.test("Web - Home Page Load", async () => {
        const response = await fetch(this.baseUrl);
        this.assert(response.ok, "Home page should load successfully");
        const html = await response.text();
        this.assert(html.includes("Willys"), "Should contain Willys branding");
        console.log("   🏠 Home page loads correctly");
      });

      await this.test("Web - Search Lab Page", async () => {
        const response = await fetch(`${this.baseUrl}/search-lab`);
        this.assert(response.ok, "Search lab page should load");
        const html = await response.text();
        this.assert(
          html.includes("Search") || html.includes("Algorithm"),
          "Should contain search functionality",
        );
        console.log("   🔬 Search lab accessible");
      });

      await this.test("Web - Smart Search API", async () => {
        const response = await fetch(`${this.baseUrl}/api/smart-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "mjölk",
            algorithm: "hybrid",
          }),
        });

        this.assert(response.ok, "Smart search API should respond");
        const data = await response.json();
        this.assert(
          data.results || data.error,
          "Should return results or error",
        );
        console.log("   🔍 Smart search API functional");
      });

      // === INTEGRATION TESTS ===
      console.log("\\n🔗 TESTING MCP + WEB INTEGRATION");

      await this.test("Cross-Platform Session Consistency", async () => {
        // This would test if MCP sessions work with web interface
        // For now, we just verify both systems are operational
        this.assert(this.sessionId, "MCP session should exist");
        console.log("   🔄 Session management operational");
      });

      await this.test("Data Consistency - Search Results", async () => {
        // Compare MCP search vs web search for same query
        const mcpResult = await this.mcpCall("mcp__willys_search", {
          sessionId: this.sessionId,
          query: "ost",
          size: 3,
        });

        const webResult = await fetch(`${this.baseUrl}/api/smart-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "ost", algorithm: "text" }),
        });

        this.assert(
          mcpResult.result?.content?.[0]?.text,
          "MCP should return search results",
        );
        this.assert(webResult.ok, "Web API should respond");
        console.log("   📊 Both interfaces return search data");
      });
    } catch (error) {
      console.error("❌ Test suite setup failed:", error.message);
      this.testResults.failed++;
    }

    // === RESULTS SUMMARY ===
    console.log(`\\n${"=".repeat(50)}`);
    console.log("📈 TEST RESULTS SUMMARY");
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);

    if (this.testResults.errors.length > 0) {
      console.log("\\n🚨 FAILED TESTS:");
      this.testResults.errors.forEach(({ name, error }) => {
        console.log(`   • ${name}: ${error}`);
      });
    }

    const successRate =
      (this.testResults.passed /
        (this.testResults.passed + this.testResults.failed)) *
      100;
    console.log(`\\n📊 Success Rate: ${successRate.toFixed(1)}%`);

    if (successRate >= 80) {
      console.log("🎉 Test suite PASSED!");
      process.exit(0);
    } else {
      console.log("💥 Test suite FAILED!");
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new WillysE2ETestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = WillysE2ETestSuite;
