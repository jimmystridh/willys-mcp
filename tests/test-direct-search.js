#!/usr/bin/env node

const puppeteer = require("puppeteer");

async function testDirectSearch() {
  console.log("🔍 Testing direct search after manual authentication");

  let browser;
  let page;

  try {
    // Launch browser with minimal setup
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      args: ["--no-sandbox"],
    });

    page = await browser.newPage();

    // Monitor console messages for debugging
    page.on("console", (msg) => {
      if (
        msg.text().includes("smart") ||
        msg.text().includes("mjölk") ||
        msg.text().includes("match")
      ) {
        console.log(`🔍 Console: ${msg.text()}`);
      }
    });

    console.log("🌐 Navigating to orders page...");
    await page.goto("http://localhost:3000/orders", {
      waitUntil: "domcontentloaded",
    });

    // Wait longer for potential authentication and page load
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const currentUrl = page.url();
    console.log("📍 Current URL:", currentUrl);

    if (currentUrl.includes("/login")) {
      console.log(
        "❌ Please manually log in through the browser, then return to this terminal and press ENTER to continue...",
      );

      // Wait for user input to continue
      await new Promise((resolve) => {
        const readline = require("node:readline").createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        readline.question("Press ENTER when logged in: ", () => {
          readline.close();
          resolve();
        });
      });

      // Navigate to orders again after login
      await page.goto("http://localhost:3000/orders", {
        waitUntil: "domcontentloaded",
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log("✅ On orders page, looking for Smart Product Matcher...");

    // Wait for the component to load
    await page.waitForTimeout(3000);

    // Find search input
    const searchInput = await page.$('input[type="text"]');
    if (!searchInput) {
      console.log("❌ No search input found");
      await page.screenshot({ path: "debug-no-input.png" });
      return;
    }

    console.log('📝 Found search input, entering "mjölk"...');
    await searchInput.click();
    await searchInput.type("mjölk");

    // Find and click search button
    const searchButton = await page.$('button[type="submit"]');
    if (!searchButton) {
      console.log("❌ No search button found");
      return;
    }

    console.log("🔘 Clicking search button and monitoring server response...");
    await searchButton.click();

    // Wait for the request to complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("✅ Search completed - check server terminal for debug logs!");

    // Take screenshot of results
    await page.screenshot({ path: "test-search-results.png", fullPage: true });
    console.log("📸 Screenshot saved: test-search-results.png");
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }

  // Don't close browser immediately so user can see results
  console.log(
    "🔍 Browser will remain open for inspection. Close manually when done.",
  );
}

testDirectSearch();
