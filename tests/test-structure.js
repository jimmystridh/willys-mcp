#!/usr/bin/env node

const puppeteer = require("puppeteer");
const _fs = require("node:fs");
const _path = require("node:path");

async function testOrderStructure() {
  console.log("🔍 Testing Order Structure");

  let browser;
  let page;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      args: ["--no-sandbox"],
    });
    page = await browser.newPage();

    console.log("🌐 Navigating to orders page...");
    await page.goto("http://localhost:3000/orders", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      console.log("❌ Need authentication - please login manually first");
      return;
    }

    console.log("✅ On orders page");

    // Find search input
    const searchInput = await page.$(
      'input[placeholder*="mjölk"], input[type="text"]',
    );
    if (!searchInput) {
      console.log("❌ No search input found");
      return;
    }

    // Enter search term
    await searchInput.click();
    await searchInput.type("mjölk");

    // Find button
    const searchButton = await page.$(
      'button[type="submit"], button:text("Find")',
    );
    if (!searchButton) {
      console.log("❌ No search button found");
      return;
    }

    console.log("🔍 Executing search to see order structure in logs...");
    await searchButton.click();

    // Wait for request
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(
      "✅ Search completed - check server logs for order structure details",
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testOrderStructure();
