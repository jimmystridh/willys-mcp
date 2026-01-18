#!/usr/bin/env node

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");

async function testSmartProductMatching() {
  console.log("🚀 Starting Puppeteer Smart Product Matching Test\n");

  let browser;
  let page;

  try {
    // Check for credentials
    const credentialsPath = path.join(process.cwd(), ".credentials");
    if (!fs.existsSync(credentialsPath)) {
      console.log("❌ No .credentials file found");
      return;
    }

    const credentialsContent = fs
      .readFileSync(credentialsPath, "utf8")
      .trim()
      .split("\n");
    const username = credentialsContent[0];
    const password = credentialsContent[1];
    console.log("✅ Found credentials for:", username);

    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Enable console logging
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("🔴 Browser Error:", msg.text());
      } else if (msg.type() === "log") {
        console.log("📝 Browser Log:", msg.text());
      }
    });

    // Navigate to the app
    console.log("🌐 Navigating to http://localhost:3000");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    // Check if we need to login
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      console.log("🔐 Login required, logging in...");

      // Wait for login form
      await page.waitForSelector(
        'input[type="email"], input[name="username"], #username',
        { timeout: 5000 },
      );

      // Fill in credentials
      const usernameField = await page.$(
        'input[type="email"], input[name="username"], #username',
      );
      const passwordField = await page.$(
        'input[type="password"], input[name="password"], #password',
      );

      if (usernameField && passwordField) {
        await usernameField.type(username);
        await passwordField.type(password);

        // Submit form
        const submitButton = await page.$(
          'button[type="submit"], input[type="submit"], .login-button',
        );
        if (submitButton) {
          console.log("📤 Submitting login form...");
          await submitButton.click();
          await page.waitForNavigation({
            waitUntil: "networkidle0",
            timeout: 10000,
          });
        }
      }
    }

    // Navigate to orders page
    console.log("📄 Navigating to orders page...");
    await page.goto("http://localhost:3000/orders", {
      waitUntil: "networkidle0",
    });

    // Wait for the Smart Product Matcher to load
    console.log("🔍 Looking for Smart Product Matcher component...");

    try {
      await page.waitForSelector('h2:text("Smart Product Matcher")', {
        timeout: 10000,
      });
      console.log("✅ Found Smart Product Matcher component!");
    } catch (_error) {
      console.log("❌ Could not find Smart Product Matcher component");

      // Take screenshot for debugging
      await page.screenshot({ path: "debug-no-smart-matcher.png" });
      console.log("📸 Debug screenshot saved: debug-no-smart-matcher.png");

      // Show page content
      const title = await page.title();
      const url = page.url();
      console.log("Page title:", title);
      console.log("Page URL:", url);

      return;
    }

    // Find the search input
    console.log("📝 Looking for search input...");
    const searchInput = await page.waitForSelector(
      'input[placeholder*="mjölk"], input[placeholder*="bröd"], .smart-matcher input[type="text"]',
      { timeout: 5000 },
    );

    if (!searchInput) {
      console.log("❌ Could not find search input");
      return;
    }

    console.log("✅ Found search input");

    // Clear and enter search term
    await searchInput.click({ clickCount: 3 }); // Select all
    await searchInput.type("mjölk");
    console.log("📝 Entered search term: mjölk");

    // Find the search button
    const searchButton = await page.$(
      'button:text("Find"), button:text("Search"), .smart-matcher button[type="submit"]',
    );
    if (!searchButton) {
      console.log("❌ Could not find search button");
      return;
    }

    console.log("🔘 Found search button, clicking...");

    // Click search and wait for network activity
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/orders") && response.status() === 200,
        { timeout: 10000 },
      ),
      searchButton.click(),
    ]);

    console.log("⏳ Waiting for results...");
    await page.waitForTimeout(2000); // Give time for UI to update

    // Check for results
    const checkResults = await page.evaluate(() => {
      // Look for various result indicators
      const errorElements = document.querySelectorAll(
        '[class*="error"], .error, .bg-red',
      );
      const messageElements = document.querySelectorAll(
        '[class*="message"], .message, .bg-blue, .bg-green',
      );
      const resultElements = document.querySelectorAll(
        '[class*="match"], .match, .product-result',
      );

      const errors = Array.from(errorElements)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0);
      const messages = Array.from(messageElements)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0);
      const results = Array.from(resultElements)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0);

      return {
        errors,
        messages,
        results,
        hasResults: results.length > 0,
        hasMessages: messages.length > 0,
        hasErrors: errors.length > 0,
      };
    });

    // Report results
    if (checkResults.hasErrors) {
      console.log("❌ Errors found:");
      checkResults.errors.forEach((error) => console.log("   ", error));
    }

    if (checkResults.hasMessages) {
      console.log("💬 Messages found:");
      checkResults.messages.forEach((message) => console.log("   ", message));
    }

    if (checkResults.hasResults) {
      console.log("✅ Product results found:");
      checkResults.results
        .slice(0, 3)
        .forEach((result, i) => console.log(`   ${i + 1}. ${result}`));
    }

    if (
      !checkResults.hasResults &&
      !checkResults.hasMessages &&
      !checkResults.hasErrors
    ) {
      console.log("❓ No clear results found. Taking screenshot...");
      await page.screenshot({ path: "debug-no-results.png" });
      console.log("📸 Debug screenshot saved: debug-no-results.png");

      // Log the smart matcher section HTML
      const smartMatcherHtml = await page.evaluate(() => {
        const matcher = document.querySelector(
          'h2:contains("Smart Product Matcher")',
        );
        return matcher
          ? matcher.parentElement.innerHTML
          : "Smart matcher section not found";
      });
      console.log(
        "HTML content preview:",
        `${smartMatcherHtml.substring(0, 500)}...`,
      );
    }

    // Check server-side logs by looking at network tab
    const _responses = await page.evaluate(() => {
      return window.lastServerResponse || "No server response captured";
    });

    console.log("\n🎯 TEST SUMMARY:");
    console.log("- Errors:", checkResults.hasErrors ? "YES" : "NO");
    console.log("- Messages:", checkResults.hasMessages ? "YES" : "NO");
    console.log("- Results:", checkResults.hasResults ? "YES" : "NO");
    console.log(
      "- Overall:",
      (checkResults.hasResults || checkResults.hasMessages) &&
        !checkResults.hasErrors
        ? "SUCCESS ✅"
        : "NEEDS ATTENTION ⚠️",
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (page) {
      await page.screenshot({ path: "debug-test-error.png" });
      console.log("📸 Error screenshot saved: debug-test-error.png");
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSmartProductMatching();
