#!/usr/bin/env node

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");

async function testCompleteFlow() {
  console.log("🚀 COMPLETE SMART PRODUCT MATCHING FLOW TEST");
  console.log("=".repeat(50));

  let browser;
  let page;

  try {
    // Get credentials
    const credentialsPath = path.join(process.cwd(), ".credentials");
    if (!fs.existsSync(credentialsPath)) {
      console.log("❌ No .credentials file found");
      console.log(
        "💡 Create .credentials file with username and password on separate lines",
      );
      return;
    }

    const credentialsContent = fs
      .readFileSync(credentialsPath, "utf8")
      .trim()
      .split("\n");
    const username = credentialsContent[0];
    const password = credentialsContent[1];

    console.log("✅ Found credentials for user:", username);

    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1400, height: 900 },
    });

    page = await browser.newPage();

    // Monitor console and network
    const consoleMessages = [];
    const networkErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleMessages.push(msg.text());
        console.log("🔴 Console Error:", msg.text());
      }
    });

    page.on("response", (response) => {
      if (!response.ok() && response.url().includes("localhost")) {
        networkErrors.push(`${response.status()} ${response.url()}`);
        console.log("🔴 Network Error:", response.status(), response.url());
      }
    });

    // Step 1: Navigate to app
    console.log("\n📍 Step 1: Navigate to app");
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 2: Handle authentication if needed
    console.log("\n🔐 Step 2: Handle authentication");
    const currentUrl = page.url();
    console.log("Current URL:", currentUrl);

    if (currentUrl.includes("/login")) {
      console.log("Authentication required, using credentials...");

      // Fill login form
      await page.waitForSelector(
        'input[type="email"], input[name="username"]',
        { timeout: 5000 },
      );
      await page.type('input[type="email"], input[name="username"]', username);
      await page.type(
        'input[type="password"], input[name="password"]',
        password,
      );

      console.log("Submitting login...");
      await page.click('button[type="submit"]');

      // Wait for login to complete (increase timeout for Willys login)
      try {
        await page.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        console.log("✅ Login completed");
      } catch (_e) {
        console.log("⚠️ Login may still be processing...");
      }
    }

    // Step 3: Navigate to orders
    console.log("\n📄 Step 3: Navigate to orders page");
    await page.goto("http://localhost:3000/orders", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const ordersUrl = page.url();
    if (ordersUrl.includes("/login")) {
      console.log("❌ Still redirected to login - authentication failed");
      console.log(
        "💡 You may need to manually complete authentication in Willys",
      );
      return;
    }

    console.log("✅ Successfully on orders page");

    // Step 4: Find Smart Product Matcher
    console.log("\n🔍 Step 4: Locate Smart Product Matcher");

    let smartMatcherFound = false;
    const selectors = ["h2", "h3", "*"];

    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate((el) => el.textContent, element);
          if (text.includes("Smart Product Matcher")) {
            smartMatcherFound = true;
            console.log("✅ Found Smart Product Matcher component");
            break;
          }
        }
        if (smartMatcherFound) break;
      } catch (_e) {
        // Continue searching
      }
    }

    if (!smartMatcherFound) {
      console.log("❌ Smart Product Matcher component not found");
      console.log("Taking screenshot for debugging...");
      await page.screenshot({ path: "debug-no-component.png", fullPage: true });
      console.log("📸 Debug screenshot: debug-no-component.png");
      return;
    }

    // Step 5: Find and use search input
    console.log("\n📝 Step 5: Test search functionality");

    const inputSelectors = [
      'input[placeholder*="mjölk"]',
      'input[type="text"]',
      'input[placeholder*="Try"]',
      "form input",
    ];

    let searchInput = null;
    for (const selector of inputSelectors) {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const isVisible = await page.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, element);

        if (isVisible) {
          searchInput = element;
          console.log(`✅ Found search input: ${selector}`);
          break;
        }
      }
      if (searchInput) break;
    }

    if (!searchInput) {
      console.log("❌ Could not find search input");
      await page.screenshot({ path: "debug-no-input.png", fullPage: true });
      return;
    }

    // Enter search term
    console.log('Entering search term "mjölk"...');
    await searchInput.click();
    await searchInput.type("mjölk");

    // Step 6: Find and click search button
    console.log("\n🔘 Step 6: Execute search");

    const buttonSelectors = [
      'button:text("Find")',
      'button:text("Search")',
      'button[type="submit"]',
      'input[type="submit"]',
      "form button",
    ];

    let searchButton = null;
    for (const selector of buttonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, button);

          if (isVisible) {
            searchButton = button;
            console.log(`✅ Found search button: ${selector}`);
            break;
          }
        }
      } catch (_e) {
        // Continue searching
      }
    }

    if (!searchButton) {
      console.log("❌ Could not find search button");
      await page.screenshot({ path: "debug-no-button.png", fullPage: true });
      return;
    }

    console.log("Clicking search button...");

    // Execute search
    try {
      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/orders"), {
          timeout: 15000,
        }),
        searchButton.click(),
      ]);
      console.log("✅ Search request completed");
    } catch (_e) {
      console.log("⚠️ Search request may have timed out, checking results...");
    }

    // Step 7: Check results
    console.log("\n🎯 Step 7: Analyze results");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Take final screenshot
    await page.screenshot({ path: "test-final-results.png", fullPage: true });

    // Analyze page content
    const pageAnalysis = await page.evaluate(() => {
      const body = document.body.textContent.toLowerCase();
      return {
        hasSmartMatches: body.includes("smart match"),
        hasNoMatches:
          body.includes("no matches") || body.includes("no products"),
        hasError: body.includes("error") || body.includes("failed"),
        hasResults: body.includes("found") && body.includes("match"),
        bodyPreview: document.body.textContent.substring(0, 500),
      };
    });

    // Step 8: Report results
    console.log("\n📊 FINAL RESULTS:");
    console.log("=".repeat(30));

    if (pageAnalysis.hasSmartMatches || pageAnalysis.hasResults) {
      console.log("✅ SUCCESS: Smart matching appears to be working!");
      if (pageAnalysis.hasResults) {
        console.log("📦 Found product matches");
      }
    } else if (pageAnalysis.hasNoMatches) {
      console.log(
        "⚠️ INFO: No matches found (this could be normal if no purchase history)",
      );
    } else if (pageAnalysis.hasError) {
      console.log("❌ ERROR: Errors detected in results");
    } else {
      console.log("❓ UNCLEAR: Could not determine definitive result");
    }

    if (consoleMessages.length > 0) {
      console.log("\n🔴 Console Errors:");
      consoleMessages.forEach((msg) => console.log("   ", msg));
    }

    if (networkErrors.length > 0) {
      console.log("\n🌐 Network Errors:");
      networkErrors.forEach((err) => console.log("   ", err));
    }

    console.log("\n📸 Screenshots saved:");
    console.log("   test-final-results.png - Final page state");
    if (fs.existsSync("debug-no-component.png"))
      console.log("   debug-no-component.png - Debug screenshot");
    if (fs.existsSync("debug-no-input.png"))
      console.log("   debug-no-input.png - Debug screenshot");
    if (fs.existsSync("debug-no-button.png"))
      console.log("   debug-no-button.png - Debug screenshot");

    console.log("\n📝 Page content preview:");
    console.log(`${pageAnalysis.bodyPreview.substring(0, 200)}...`);
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error.message);
    if (page) {
      await page.screenshot({ path: "test-error.png", fullPage: true });
      console.log("📸 Error screenshot: test-error.png");
    }
  } finally {
    if (browser) {
      console.log("\n🔚 Test completed, closing browser...");
      await browser.close();
    }
  }
}

// Run the test
testCompleteFlow();
