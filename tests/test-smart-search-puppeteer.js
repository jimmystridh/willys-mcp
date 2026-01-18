#!/usr/bin/env node

/**
 * E2E test using Puppeteer to test smart search and reproduce database error
 */

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");

async function testSmartSearchWithPuppeteer() {
  console.log("🧪 E2E Smart Search Test with Puppeteer");
  console.log("=====================================\n");

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
      headless: false, // Show browser for debugging
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    // Listen for console errors (this should catch the database error)
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("🚨 Browser console error:", msg.text());
      }
    });

    // Listen for page errors
    page.on("pageerror", (error) => {
      console.log("🚨 Page error:", error.message);
    });

    console.log("🌐 Navigating to http://localhost:3009...");
    await page.goto("http://localhost:3009", { waitUntil: "networkidle2" });

    // Check if we're on login page
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      console.log("📋 Login required, filling credentials...");

      // Fill login form
      await page.type('input[name="username"], input[type="email"]', username);
      await page.type(
        'input[name="password"], input[type="password"]',
        password,
      );

      // Submit and wait
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        page.click('button[type="submit"]'),
      ]);

      console.log("✅ Login completed");
    }

    // Navigate to orders page where smart search is
    console.log("📄 Navigating to orders page...");
    await page.goto("http://localhost:3009/orders", {
      waitUntil: "networkidle2",
    });

    // Wait for Smart Product Matcher to load
    await page.waitForSelector("h2", { timeout: 10000 });

    // Look for the smart matcher section using a better selector
    const _smartMatcherExists = await page.$("h2");
    const pageText = await page.evaluate(() => document.body.textContent);

    if (!pageText.includes("Smart Product Matcher")) {
      console.log("❌ Smart Product Matcher not found on page");
      console.log(
        "Available headings:",
        await page.$$eval("h1, h2, h3", (elements) =>
          elements.map((el) => el.textContent),
        ),
      );
      console.log("Page content preview:", pageText.substring(0, 1000));
      return;
    }

    console.log("✅ Found Smart Product Matcher section");

    // Find search input and button using better selectors
    const searchInput = await page.$('input[type="text"]');
    const searchButton = await page.$("button");

    if (!searchInput || !searchButton) {
      console.log("❌ Could not find search input or button");
      return;
    }

    console.log('🔍 Entering search term "ost"...');
    await searchInput.click({ clickCount: 3 }); // Select all
    await searchInput.type("ost");

    console.log("🔘 Clicking search button...");

    // This should trigger the server action and potentially the database error
    await searchButton.click();

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check for results or error messages
    const updatedPageText = await page.evaluate(
      () => document.body.textContent,
    );

    if (
      updatedPageText.includes("TypeError") ||
      updatedPageText.includes("path")
    ) {
      console.log("🔍 Found database path error in page!");
      console.log(
        "Error context:",
        updatedPageText.substring(
          updatedPageText.indexOf("TypeError"),
          updatedPageText.indexOf("TypeError") + 200,
        ),
      );
    }

    // Look for results
    const results = await page.$$('[class*="match"], .match-result');
    if (results.length > 0) {
      console.log("✅ Found", results.length, "match results");

      // Get first result details
      const firstResult = results[0];
      const productText = await firstResult.evaluate((el) => el.textContent);
      console.log("📦 First result:", productText.substring(0, 100));
    } else {
      console.log("❌ No match results found");
    }

    // Take screenshot for debugging
    await page.screenshot({
      path: "smart-search-puppeteer-test.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved as smart-search-puppeteer-test.png");

    console.log("✅ E2E test completed");
  } catch (error) {
    console.error("❌ E2E test error:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if server is running first
async function checkServerRunning() {
  try {
    const _response = await fetch("http://localhost:3009");
    return true;
  } catch (_error) {
    return false;
  }
}

async function main() {
  const isRunning = await checkServerRunning();
  if (!isRunning) {
    console.log("❌ Server not running on http://localhost:3009");
    console.log("Please run: npm run dev");
    process.exit(1);
  }

  await testSmartSearchWithPuppeteer();
}

main();
