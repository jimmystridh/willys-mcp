const { test, expect } = require("@playwright/test");

test.describe("Smart Product Matching UI Test", () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto("http://localhost:3009");
  });

  test("should test smart product matching functionality", async ({ page }) => {
    console.log("🧪 Starting Smart Product Matching UI Test");

    // Capture console errors from the beginning
    const consoleMessages = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("🚨 Browser console error:", msg.text());
        consoleMessages.push(msg.text());
      }
    });

    // Check if we're redirected to login
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();

    if (currentUrl.includes("/login")) {
      console.log("📋 Need to login first");

      // Check if we have credentials
      const fs = require("node:fs");
      const path = require("node:path");
      const credentialsPath = path.join(process.cwd(), ".credentials");

      if (!fs.existsSync(credentialsPath)) {
        console.log("❌ No .credentials file found. Skipping login test.");
        return;
      }

      const credentialsContent = fs
        .readFileSync(credentialsPath, "utf8")
        .trim()
        .split("\n");
      const username = credentialsContent[0];
      const password = credentialsContent[1];

      console.log("🔑 Logging in with credentials...");

      // Fill login form
      await page.fill(
        'input[name="username"], input[type="email"], #username',
        username,
      );
      await page.fill(
        'input[name="password"], input[type="password"], #password',
        password,
      );

      // Submit login
      await page.click(
        'button[type="submit"], input[type="submit"], .login-button',
      );

      // Wait for redirect
      await page.waitForLoadState("networkidle");

      // Check if login was successful
      const loginUrl = page.url();
      if (loginUrl.includes("/login")) {
        console.log("❌ Login failed or still on login page");
        return;
      }

      console.log("✅ Login successful, navigating to orders page");
    }

    // Navigate to orders page
    await page.goto("http://localhost:3009/orders");
    await page.waitForLoadState("networkidle");

    console.log("📄 On orders page, looking for Smart Product Matcher...");

    // Look for the Smart Product Matcher component
    const smartMatcherHeading = page.locator(
      'h2:has-text("Smart Product Matcher")',
    );
    await expect(smartMatcherHeading).toBeVisible({ timeout: 10000 });

    console.log("✅ Found Smart Product Matcher component");

    // Find the search input
    const searchInput = page
      .locator(
        'input[placeholder*="mjölk"], input[placeholder*="Try"], .smart-matcher input[type="text"]',
      )
      .first();
    await expect(searchInput).toBeVisible();

    console.log("🔍 Found search input, entering search term...");

    // Enter search term
    await searchInput.fill("mjölk");

    // Find and click the search button
    const searchButton = page
      .locator(
        'button:has-text("Find"), button:has-text("Search"), .smart-matcher button',
      )
      .first();
    await expect(searchButton).toBeVisible();

    console.log("🔘 Clicking search button...");

    // Click search and wait for response
    await searchButton.click();

    // Wait a moment for the request to complete
    await page.waitForTimeout(3000);

    // Check for results or error messages
    const hasResults =
      (await page
        .locator('.smart-matcher .matches, .match-result, [class*="match"]')
        .count()) > 0;
    const hasMessage =
      (await page
        .locator(
          '.smart-matcher [class*="message"], .smart-matcher [class*="error"], .smart-matcher [class*="info"]',
        )
        .count()) > 0;

    if (hasResults) {
      console.log("✅ Found product match results!");

      // Get the first result details
      const firstResult = page
        .locator(
          '.smart-matcher .match-result, .smart-matcher [class*="match"]',
        )
        .first();
      const productName = await firstResult
        .locator('[class*="name"], h3, h4, .product-name')
        .first()
        .textContent();
      const score = await firstResult
        .locator('[class*="score"], .score')
        .first()
        .textContent();

      console.log("📦 First match:", productName);
      console.log("📊 Score:", score);
    } else if (hasMessage) {
      console.log("📝 Found message response");
      const message = await page
        .locator(
          '.smart-matcher [class*="message"], .smart-matcher [class*="error"], .smart-matcher [class*="info"]',
        )
        .first()
        .textContent();
      console.log("💬 Message:", message);
    } else {
      console.log("❓ No clear results or messages found");

      // Take a screenshot for debugging
      await page.screenshot({ path: "smart-matcher-test-debug.png" });
      console.log("📸 Screenshot saved as smart-matcher-test-debug.png");

      // Log the page content for debugging
      const pageContent = await page.content();
      console.log(
        "🔍 Page content preview:",
        `${pageContent.substring(0, 500)}...`,
      );
    }

    if (consoleMessages.length > 0) {
      console.log("⚠️  Browser console errors summary:");
      consoleMessages.forEach((msg) => console.log("   ", msg));
    }

    console.log("✅ Smart Product Matching test completed");
  });
});
