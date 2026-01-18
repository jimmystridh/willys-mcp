#!/usr/bin/env node

const puppeteer = require("puppeteer");
const _fs = require("node:fs");
const _path = require("node:path");

async function testSmartProductMatching() {
  console.log("🚀 Starting Final Smart Product Matching Test\n");

  let browser;
  let page;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Monitor console messages
    page.on("console", (msg) => {
      console.log(`🗨️  ${msg.type()}: ${msg.text()}`);
    });

    console.log("🌐 Navigating to orders page directly...");
    await page.goto("http://localhost:3000/orders", {
      waitUntil: "domcontentloaded",
    });

    // Give more time for potential redirects and authentication
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const currentUrl = page.url();
    console.log("📍 Current URL:", currentUrl);

    if (currentUrl.includes("/login")) {
      console.log("❌ Still on login page - authentication needed");
      console.log(
        "💡 Please manually log in to Willys in your browser first, then run this test again",
      );
      return;
    }

    // Look for the orders page elements
    console.log("🔍 Checking if we are on the orders page...");

    try {
      // Wait for page to load fully
      await page.waitForSelector("h1, .orders, .smart-matcher", {
        timeout: 10000,
      });
      console.log("✅ Orders page loaded successfully");
    } catch (_error) {
      console.log("⚠️ Orders page may not have loaded fully, continuing...");
    }

    // Look for Smart Product Matcher
    console.log("🔍 Looking for Smart Product Matcher...");

    const smartMatcher =
      (await page.$('h2:text("Smart Product Matcher")')) ||
      (await page.$('*:text("Smart Product Matcher")')) ||
      (await page.$('[class*="smart"], [id*="smart"]'));

    if (!smartMatcher) {
      console.log("❌ Smart Product Matcher not found");

      // Show what's actually on the page
      const pageTitle = await page.title();
      const headings = await page.$$eval("h1, h2, h3", (els) =>
        els.map((el) => el.textContent.trim()),
      );

      console.log("📄 Page title:", pageTitle);
      console.log("📝 Headings found:", headings);

      // Take screenshot
      await page.screenshot({
        path: "debug-no-smart-matcher.png",
        fullPage: true,
      });
      console.log("📸 Screenshot saved: debug-no-smart-matcher.png");
      return;
    }

    console.log("✅ Found Smart Product Matcher!");

    // Look for search input
    const searchSelectors = [
      'input[placeholder*="mjölk"]',
      'input[placeholder*="bröd"]',
      'input[placeholder*="Try"]',
      'input[type="text"]',
      ".smart-matcher input",
      '[class*="smart"] input',
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      searchInput = await page.$(selector);
      if (searchInput) {
        console.log(`✅ Found search input with selector: ${selector}`);
        break;
      }
    }

    if (!searchInput) {
      console.log("❌ Could not find search input");
      await page.screenshot({
        path: "debug-no-search-input.png",
        fullPage: true,
      });
      return;
    }

    // Enter search term
    console.log("📝 Entering search term...");
    await searchInput.click();
    await searchInput.type("mjölk", { delay: 100 });

    // Look for search button
    const buttonSelectors = [
      'button:text("Find")',
      'button:text("Search")',
      'button[type="submit"]',
      ".smart-matcher button",
      '[class*="smart"] button',
    ];

    let searchButton = null;
    for (const selector of buttonSelectors) {
      searchButton = await page.$(selector);
      if (searchButton) {
        console.log(`✅ Found search button with selector: ${selector}`);
        break;
      }
    }

    if (!searchButton) {
      console.log("❌ Could not find search button");
      await page.screenshot({
        path: "debug-no-search-button.png",
        fullPage: true,
      });
      return;
    }

    console.log("🔘 Clicking search button...");

    // Click and wait for response
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) => {
          return (
            response.url().includes("/orders") &&
            (response.status() === 200 || response.status() === 500)
          );
        },
        { timeout: 15000 },
      ),
      searchButton.click(),
    ]);

    console.log(`📡 Got response: ${response.status()}`);

    // Wait for results to render
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check for any visible results or messages
    const results = await page.evaluate(() => {
      // Look for result elements
      const errorElements = Array.from(
        document.querySelectorAll(
          '[class*="error"], .error, .bg-red-50, .text-red',
        ),
      );
      const messageElements = Array.from(
        document.querySelectorAll(
          '[class*="message"], .message, .bg-blue-50, .bg-green-50',
        ),
      );
      const resultElements = Array.from(
        document.querySelectorAll(
          '[class*="match"], [class*="result"], .product',
        ),
      );

      const getVisibleText = (elements) => {
        return elements
          .filter((el) => el.offsetParent !== null) // Only visible elements
          .map((el) => el.textContent.trim())
          .filter((text) => text.length > 5); // Filter out short/empty text
      };

      return {
        errors: getVisibleText(errorElements),
        messages: getVisibleText(messageElements),
        results: getVisibleText(resultElements),
        allText:
          document.body.textContent.includes("Smart matches") ||
          document.body.textContent.includes("No matches") ||
          document.body.textContent.includes("Found"),
      };
    });

    console.log("\n🎯 TEST RESULTS:");

    if (results.errors.length > 0) {
      console.log("❌ ERRORS:");
      results.errors.forEach((error) => console.log("   ", error));
    }

    if (results.messages.length > 0) {
      console.log("💬 MESSAGES:");
      results.messages.forEach((message) => console.log("   ", message));
    }

    if (results.results.length > 0) {
      console.log("📦 RESULTS:");
      results.results
        .slice(0, 5)
        .forEach((result) => console.log("   ", result));
    }

    if (results.allText) {
      console.log("✅ Found smart matching text in page");
    }

    // Final screenshot
    await page.screenshot({ path: "test-final-result.png", fullPage: true });
    console.log("📸 Final screenshot: test-final-result.png");

    // Summary
    const success =
      (results.messages.length > 0 || results.results.length > 0) &&
      results.errors.length === 0;
    console.log(
      "\n🏆 OVERALL RESULT:",
      success ? "SUCCESS ✅" : "NEEDS INVESTIGATION ⚠️",
    );

    if (!success) {
      console.log("\n🔧 DEBUGGING TIPS:");
      console.log("1. Check server logs for authentication or API errors");
      console.log(
        "2. Verify Smart Product Matcher component is properly rendered",
      );
      console.log("3. Check browser console for JavaScript errors");
      console.log("4. Ensure order history exists in your Willys account");
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error.message);

    if (page) {
      await page.screenshot({
        path: "test-error-screenshot.png",
        fullPage: true,
      });
      console.log("📸 Error screenshot saved");
    }
  } finally {
    if (browser) {
      console.log("🔚 Closing browser...");
      await browser.close();
    }
  }
}

// Run the test
testSmartProductMatching();
