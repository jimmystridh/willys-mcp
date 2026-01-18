const { chromium } = require("@playwright/test");

async function testWillysSearch() {
  console.log("🔍 Starting Willys Search Analysis with Playwright...\n");

  const browser = await chromium.launch({
    headless: false, // Set to true for headless mode
    slowMo: 1000, // Slow down for better observation
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Arrays to store network requests
  const searchRequests = [];
  const searchResponses = [];

  // Listen to network requests
  page.on("request", (request) => {
    const url = request.url();
    if (
      url.includes("search") ||
      url.includes("product") ||
      url.includes("autocomplete") ||
      url.includes("typeahead") ||
      url.includes("suggest") ||
      url.includes("/axfood/rest/")
    ) {
      searchRequests.push({
        url: url,
        method: request.method(),
        headers: Object.fromEntries(Object.entries(request.headers())),
        postData: request.postData(),
        timestamp: Date.now(),
      });
      console.log(`📤 REQUEST: ${request.method()} ${url}`);
    }
  });

  // Listen to network responses
  page.on("response", async (response) => {
    const url = response.url();
    if (
      url.includes("search") ||
      url.includes("product") ||
      url.includes("autocomplete") ||
      url.includes("typeahead") ||
      url.includes("suggest") ||
      url.includes("/axfood/rest/")
    ) {
      let responseBody = null;
      try {
        responseBody = await response.text();
      } catch (e) {
        console.log(`❌ Could not read response body for ${url}: ${e.message}`);
      }

      searchResponses.push({
        url: url,
        status: response.status(),
        headers: Object.fromEntries(Object.entries(response.headers())),
        body: responseBody,
        timestamp: Date.now(),
      });
      console.log(`📥 RESPONSE: ${response.status()} ${url}`);
    }
  });

  try {
    console.log("📝 Step 1: Navigating to Willys website...");
    await page.goto("https://www.willys.se", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("   ✅ Successfully loaded Willys homepage");
    console.log(`   📄 Page title: ${await page.title()}`);

    // Handle cookie consent if present
    console.log("📝 Step 2: Handling cookie consent...");
    try {
      const cookieButton = await page.waitForSelector(
        'button[id*="accept"], button[class*="accept"], button:has-text("Acceptera"), button:has-text("Accept")',
        {
          timeout: 5000,
        },
      );
      if (cookieButton) {
        await cookieButton.click();
        console.log("   ✅ Cookie consent handled");
        await page.waitForTimeout(1000);
      }
    } catch (_e) {
      console.log("   ℹ️ No cookie consent banner found or already accepted");
    }

    console.log("📝 Step 3: Finding search functionality...");

    // Look for search input field
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="Sök"]',
      'input[placeholder*="Search"]',
      'input[name*="search"]',
      'input[id*="search"]',
      ".search input",
      "#search input",
      'input[data-testid*="search"]',
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        searchInput = await page.waitForSelector(selector, { timeout: 2000 });
        if (searchInput) {
          console.log(`   ✅ Found search input with selector: ${selector}`);
          break;
        }
      } catch (_e) {
        // Continue trying other selectors
      }
    }

    if (!searchInput) {
      console.log(
        "   ⚠️ Search input not found. Inspecting page for search elements...",
      );

      // Debug: find all input elements
      const allInputs = await page.locator("input").all();
      console.log(`   📋 Found ${allInputs.length} input elements on page:`);

      for (let i = 0; i < allInputs.length && i < 10; i++) {
        const input = allInputs[i];
        try {
          const type = await input.getAttribute("type");
          const placeholder = await input.getAttribute("placeholder");
          const name = await input.getAttribute("name");
          const id = await input.getAttribute("id");
          const className = await input.getAttribute("class");
          console.log(
            `   Input ${i + 1}: type="${type}", placeholder="${placeholder}", name="${name}", id="${id}", class="${className}"`,
          );
        } catch (_e) {
          console.log(`   Input ${i + 1}: Error reading attributes`);
        }
      }

      // Try to find search by looking at the page content
      const pageContent = await page.content();
      console.log(
        "\n   📋 Looking for search-related elements in page content...",
      );
      if (pageContent.includes("search") || pageContent.includes("Sök")) {
        console.log("   ✅ Page contains search-related content");
      }

      throw new Error("Could not locate search input field");
    }

    console.log("📝 Step 4: Testing search functionality...");

    const searchTerms = ["mjölk", "bröd", "äpplen"];

    for (const searchTerm of searchTerms) {
      console.log(`\n🔍 Testing search for: "${searchTerm}"`);

      // Clear any existing content
      await searchInput.fill("");
      await page.waitForTimeout(500);

      // Type the search term character by character to trigger autocomplete
      await searchInput.type(searchTerm, { delay: 100 });

      console.log(`   ⌨️ Typed search term: "${searchTerm}"`);

      // Wait for potential autocomplete/suggestions
      await page.waitForTimeout(1000);

      // Look for autocomplete/dropdown suggestions
      const suggestionSelectors = [
        ".search-suggestions",
        ".autocomplete",
        ".dropdown",
        ".typeahead",
        '[data-testid*="suggestion"]',
        '[role="listbox"]',
        ".search-results",
      ];

      let suggestions = null;
      for (const selector of suggestionSelectors) {
        try {
          suggestions = await page.waitForSelector(selector, { timeout: 1000 });
          if (suggestions) {
            console.log(`   📝 Found suggestions with selector: ${selector}`);

            // Get suggestion text
            const suggestionTexts = await page
              .locator(`${selector} li, ${selector} div, ${selector} a`)
              .allTextContents();
            console.log(
              `   📋 Suggestions: ${suggestionTexts.slice(0, 5).join(", ")}${suggestionTexts.length > 5 ? "..." : ""}`,
            );
            break;
          }
        } catch (_e) {
          // Continue trying other selectors
        }
      }

      if (!suggestions) {
        console.log("   ℹ️ No autocomplete suggestions found");
      }

      // Submit search by pressing Enter
      await searchInput.press("Enter");
      console.log("   ✅ Submitted search");

      // Wait for search results to load
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
        console.log("   ✅ Search results page loaded");

        // Check if we're on a search results page
        const currentUrl = page.url();
        console.log(`   📍 Current URL: ${currentUrl}`);

        // Look for search results
        const resultSelectors = [
          ".product",
          ".search-result",
          ".product-item",
          '[data-testid*="product"]',
          ".grid .card",
        ];

        let resultsFound = false;
        for (const selector of resultSelectors) {
          try {
            const results = await page.locator(selector).count();
            if (results > 0) {
              console.log(
                `   🎯 Found ${results} search results with selector: ${selector}`,
              );

              // Get details of first few results
              const resultTitles = await page
                .locator(
                  `${selector} h2, ${selector} h3, ${selector} .title, ${selector} .name`,
                )
                .allTextContents();
              console.log(
                `   📋 First few results: ${resultTitles.slice(0, 3).join(", ")}`,
              );
              resultsFound = true;
              break;
            }
          } catch (_e) {
            // Continue trying other selectors
          }
        }

        if (!resultsFound) {
          console.log("   ⚠️ No search results found with known selectors");
        }
      } catch (e) {
        console.log(`   ⚠️ Error waiting for search results: ${e.message}`);
      }

      // Wait before next search
      await page.waitForTimeout(2000);
    }

    console.log("\n📊 Analysis Complete!");
    console.log(
      `📈 Captured ${searchRequests.length} requests and ${searchResponses.length} responses`,
    );

    // Save detailed analysis to files
    await saveAnalysisToFiles(searchRequests, searchResponses);
  } catch (error) {
    console.error("❌ Error during Willys search analysis:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    await browser.close();
  }
}

async function saveAnalysisToFiles(requests, responses) {
  const fs = require("node:fs");

  console.log("\n📝 Saving detailed analysis to files...");

  // Create docs/willys directory if it doesn't exist
  if (!fs.existsSync("docs/willys")) {
    fs.mkdirSync("docs/willys", { recursive: true });
  }

  // Save requests
  const requestsData = {
    timestamp: new Date().toISOString(),
    totalRequests: requests.length,
    requests: requests,
  };

  fs.writeFileSync(
    "docs/willys/search-requests.json",
    JSON.stringify(requestsData, null, 2),
  );
  console.log(
    "   ✅ Search requests saved to docs/willys/search-requests.json",
  );

  // Save responses
  const responsesData = {
    timestamp: new Date().toISOString(),
    totalResponses: responses.length,
    responses: responses.map((r) => ({
      ...r,
      bodyPreview: r.body
        ? r.body.substring(0, 1000) + (r.body.length > 1000 ? "..." : "")
        : null,
      bodyLength: r.body ? r.body.length : 0,
    })),
  };

  fs.writeFileSync(
    "docs/willys/search-responses.json",
    JSON.stringify(responsesData, null, 2),
  );
  console.log(
    "   ✅ Search responses saved to docs/willys/search-responses.json",
  );

  // Create a summary document
  const summary = generateSearchSummary(requests, responses);
  fs.writeFileSync("docs/willys/search-analysis.md", summary);
  console.log(
    "   ✅ Search analysis summary saved to docs/willys/search-analysis.md",
  );
}

function generateSearchSummary(requests, responses) {
  const uniqueUrls = [...new Set(requests.map((r) => r.url))];
  const searchEndpoints = requests.filter(
    (r) =>
      r.url.includes("search") ||
      r.url.includes("product") ||
      r.url.includes("autocomplete") ||
      r.url.includes("suggest"),
  );

  return `# Willys Search Analysis

## Summary

- **Analysis Date**: ${new Date().toISOString()}
- **Total Network Requests**: ${requests.length}
- **Total Network Responses**: ${responses.length}
- **Unique URLs**: ${uniqueUrls.length}
- **Search-related Requests**: ${searchEndpoints.length}

## API Endpoints Discovered

${uniqueUrls.map((url) => `- \`${url}\``).join("\n")}

## Request Methods Used

${[...new Set(requests.map((r) => r.method))]
  .map(
    (method) =>
      `- **${method}**: ${requests.filter((r) => r.method === method).length} requests`,
  )
  .join("\n")}

## Response Status Codes

${[...new Set(responses.map((r) => r.status))]
  .map(
    (status) =>
      `- **${status}**: ${responses.filter((r) => r.status === status).length} responses`,
  )
  .join("\n")}

## Search Functionality Observations

1. **Search Input Detection**: ${requests.length > 0 ? "Successfully detected and interacted with search input" : "Search input detection needs investigation"}

2. **Network Activity**: ${requests.length > 0 ? `Captured ${requests.length} network requests during search operations` : "No significant network activity detected"}

3. **API Patterns**: 
${
  searchEndpoints.length > 0
    ? searchEndpoints
        .slice(0, 5)
        .map((req, _i) => `   - ${req.method} ${req.url}`)
        .join("\n")
    : "   - No clear search API patterns detected"
}

## Next Steps

${
  requests.length > 0
    ? `1. Analyze the captured request/response data in detail
2. Implement search functionality in the MCP server
3. Add search capabilities to the web UI`
    : `1. Investigate alternative search implementations on Willys
2. Check for SPA routing or different search mechanisms
3. Consider authentication requirements for search`
}

## Raw Data

- Full request details: \`docs/willys/search-requests.json\`
- Full response details: \`docs/willys/search-responses.json\`
`;
}

// Run the analysis
testWillysSearch().catch(console.error);
