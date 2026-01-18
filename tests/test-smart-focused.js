#!/usr/bin/env node

/**
 * Focused test to trigger the smart search and capture the exact error
 */

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");

async function testSmartSearchFocused() {
  console.log("🧪 Focused Smart Search Test");
  console.log("============================\n");

  let browser;
  let page;

  try {
    // Read credentials
    const credentialsPath = path.join(process.cwd(), ".credentials");
    if (!fs.existsSync(credentialsPath)) {
      throw new Error("❌ No .credentials file found");
    }

    const credentialsContent = fs
      .readFileSync(credentialsPath, "utf8")
      .trim()
      .split("\n");
    const username = credentialsContent[0];
    const password = credentialsContent[1];

    console.log("🔑 Loaded credentials for:", username);

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    // Set up comprehensive error logging
    page.on("console", (msg) => {
      console.log("🟡 Browser console:", msg.type(), "-", msg.text());
    });

    page.on("pageerror", (error) => {
      console.log("🔴 Page error:", error.message);
    });

    page.on("requestfailed", (request) => {
      console.log(
        "🔴 Request failed:",
        request.url(),
        request.failure()?.errorText,
      );
    });

    // Navigate to app
    console.log("🌐 Navigating to http://localhost:3009...");
    await page.goto("http://localhost:3009", { waitUntil: "networkidle0" });

    // Check if we need to login
    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      console.log("📋 Logging in...");
      await page.type('input[name="username"], input[type="email"]', username);
      await page.type(
        'input[name="password"], input[type="password"]',
        password,
      );

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        page.click('button[type="submit"]'),
      ]);
      console.log("✅ Login completed");
    }

    // Navigate to orders page explicitly
    console.log("📄 Navigating to orders page...");
    await page.goto("http://localhost:3009/orders", {
      waitUntil: "networkidle0",
    });

    // Wait for Smart Product Matcher
    console.log("⏳ Waiting for Smart Product Matcher...");
    await page.waitForSelector("h2", { timeout: 10000 });

    // Check for Smart Product Matcher
    const pageText = await page.evaluate(() => document.body.textContent);
    if (!pageText.includes("Smart Product Matcher")) {
      console.log("❌ Smart Product Matcher not found");
      return;
    }

    console.log("✅ Found Smart Product Matcher");

    // Find and fill the search input
    console.log("🔍 Looking for search input...");
    const searchInput = await page.waitForSelector(
      'input[type="text"][placeholder*="mjölk"]',
      { timeout: 5000 },
    );

    if (!searchInput) {
      console.log("❌ Search input not found");
      return;
    }

    console.log("✅ Found search input");

    // Clear and type search term
    await searchInput.click({ clickCount: 3 });
    await searchInput.type("ost");
    console.log('✅ Entered "ost"');

    // Find and click the search button
    console.log("🔘 Looking for search button...");
    const findButton = await page.waitForSelector("button:not([disabled])", {
      timeout: 5000,
    });

    if (!findButton) {
      console.log("❌ Find button not found");
      return;
    }

    console.log("✅ Found Find button, clicking...");

    // This should trigger the smart search and the error
    await findButton.click();

    // Wait for any error responses
    console.log("⏳ Waiting for search response...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check the page content for results or errors
    const updatedPageText = await page.evaluate(
      () => document.body.textContent,
    );

    if (
      updatedPageText.includes("TypeError") ||
      updatedPageText.includes("error")
    ) {
      console.log("🔍 Found error in page content");

      // Try to extract error details
      const errorElement = await page.$(
        '.text-red-800, .bg-red-50 .text-red-800, [class*="error"]',
      );
      if (errorElement) {
        const errorText = await errorElement.evaluate((el) => el.textContent);
        console.log("📋 Error text:", errorText);
      }
    }

    // Look for results
    const results = await page.$$('[class*="p-4"][class*="rounded-lg"]');
    console.log(`📊 Found ${results.length} potential results`);

    // Take a screenshot
    await page.screenshot({
      path: "smart-search-focused-test.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved");

    console.log("✅ Focused test completed");
  } catch (error) {
    console.error("❌ Test error:", error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testSmartSearchFocused();
