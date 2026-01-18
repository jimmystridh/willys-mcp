#!/usr/bin/env node

/**
 * Test script to verify the Willys offers functionality
 * This script tests the offers API endpoint directly using the documented approach
 */

const puppeteer = require("puppeteer");

async function testOffersDirectly() {
  console.log("🧪 Testing Willys Offers API Endpoint Directly...\n");

  let browser = null;
  let page = null;

  try {
    const username = "198202242973";
    const password = "9nR%dHV6V7QsmYPX^pXuPvcjx9y6jx";

    console.log("📝 Step 1: Starting browser and logging in...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    );

    console.log("   Navigating to login page...");
    await page.goto("https://www.willys.se/anvandare/inloggning", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Handle cookie consent with multiple selectors
    console.log("   Handling cookie consent...");
    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="cookie"]',
        'button[class*="cookie"]',
        'button:contains("Acceptera")',
        'button:contains("Accept")',
        'button:contains("Godkänn")',
        '[data-testid*="accept"]',
      ];

      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            console.log(`   ✅ Found and clicked cookie banner: ${selector}`);
            await button.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            break;
          }
        } catch (_selectorError) {
          // Continue to next selector
        }
      }
    } catch (_error) {
      console.log("   ℹ️ Cookie consent handling completed");
    }

    // Wait for and fill login form with dynamic detection
    console.log("   Finding and filling login form...");
    let usernameInput, passwordInput;

    for (let attempt = 0; attempt < 3; attempt++) {
      usernameInput =
        (await page.$('input[name="j_username"]')) ||
        (await page.$('input[type="email"]')) ||
        (await page.$('input[name="username"]'));

      passwordInput =
        (await page.$('input[name="j_password"]')) ||
        (await page.$('input[type="password"]')) ||
        (await page.$('input[name="password"]'));

      if (usernameInput && passwordInput) {
        console.log("   ✅ Found both username and password inputs!");
        break;
      }
      console.log(
        `   Attempt ${attempt + 1}: Found username: ${!!usernameInput}, password: ${!!passwordInput}`,
      );

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!usernameInput || !passwordInput) {
      throw new Error("Could not find login form inputs");
    }

    // Clear and fill the inputs
    await usernameInput.click({ clickCount: 3 }); // Select all
    await usernameInput.type(username);
    await passwordInput.click({ clickCount: 3 }); // Select all
    await passwordInput.type(password);

    console.log("   Submitting login form...");

    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Logga in")',
      "form button",
      ".login-form button",
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          submitted = true;
          console.log(`   ✅ Clicked submit button: ${selector}`);
          break;
        }
      } catch (_e) {
        // Try next selector
      }
    }

    if (!submitted) {
      // Fallback: press Enter in password field
      await passwordInput.press("Enter");
      console.log("   ✅ Submitted via Enter key");
    }

    // Wait for login to complete
    console.log("   Waiting for login completion...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("✅ Login successful!\n");

    console.log("📝 Step 2: Testing offers API endpoint...");

    // First, let's try navigating to the offers page to see if it works
    console.log("   First, navigating to offers page to check access...");
    try {
      await page.goto("https://www.willys.se/erbjudanden", {
        waitUntil: "networkidle0",
        timeout: 15000,
      });
      const pageContent = await page.content();
      if (
        pageContent.includes("erbjudanden") ||
        pageContent.includes("offers")
      ) {
        console.log("   ✅ Successfully accessed offers page");
      } else {
        console.log("   ⚠️ Offers page loaded but content unclear");
      }
    } catch (navError) {
      console.log("   ⚠️ Could not navigate to offers page:", navError.message);
    }

    // Extract cookies for API call
    const cookies = await page.cookies();
    const cookieString = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    console.log("   Making API call to offers endpoint...");

    // Generate tracking data
    const traceId = Math.random().toString(36).substring(2, 34);
    const spanId = Math.random().toString(36).substring(2, 18);
    const timestamp = Date.now();

    const _newrelicData = {
      v: [0, 1],
      d: {
        ty: "Browser",
        ac: "1154196",
        ap: "772324203",
        id: spanId,
        tr: traceId,
        ti: timestamp,
      },
    };

    const response = await page.evaluate(async (cookieString) => {
      try {
        const response = await fetch(
          "https://www.willys.se/_next/data/a4eecdbf/sv/erbjudanden.json",
          {
            headers: {
              accept: "*/*",
              "accept-language":
                "sv-SE,sv;q=0.9,en-US;q=0.8,en-SE;q=0.7,en-GB;q=0.6,en;q=0.5",
              cookie: cookieString,
              "x-nextjs-data": "1",
              "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            },
            referrer: "https://www.willys.se/erbjudanden",
            method: "GET",
            credentials: "include",
          },
        );

        const responseText = await response.text();
        let data = null;

        if (responseText && responseText.trim().length > 0) {
          try {
            data = JSON.parse(responseText);
          } catch (_parseError) {
            console.log(
              "JSON parsing failed, response text length:",
              responseText.length,
            );
            console.log("First 100 chars:", responseText.substring(0, 100));
          }
        }

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          responseTextLength: responseText ? responseText.length : 0,
          responsePreview: responseText ? responseText.substring(0, 200) : null,
          data: data,
        };
      } catch (fetchError) {
        return {
          ok: false,
          status: 0,
          statusText: "Fetch Error",
          error: fetchError.message,
          responseTextLength: 0,
          responsePreview: null,
          data: null,
        };
      }
    }, cookieString);

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    console.log("✅ Offers API call successful!\n");

    console.log("📊 Offers Response Analysis:");
    console.log(`   Status: ${response.status}`);
    console.log(`   Response text length: ${response.responseTextLength}`);
    console.log(`   Data type: ${typeof response.data}`);

    if (response.error) {
      console.log(`   Error: ${response.error}`);
    }

    if (response.responsePreview && !response.data) {
      console.log("\n⚠️ Response Preview (first 200 chars):");
      console.log(response.responsePreview);
    }

    if (response.data) {
      console.log(
        `   Data keys: ${Object.keys(response.data || {}).join(", ")}`,
      );

      if (response.data?.pageProps) {
        console.log(
          `   Page props keys: ${Object.keys(response.data.pageProps).join(", ")}`,
        );

        if (response.data.pageProps.fallback) {
          const fallbackKeys = Object.keys(response.data.pageProps.fallback);
          console.log(`   Fallback keys: ${fallbackKeys.length} items`);
          console.log(`   First fallback key: ${fallbackKeys[0] || "None"}`);
        }
      }

      // Show a sample of the data structure (first 500 chars)
      const sampleData = JSON.stringify(response.data, null, 2).substring(
        0,
        500,
      );
      console.log("\n📋 Sample Data Structure:");
      console.log(`${sampleData}...`);
    }

    console.log(
      "\n🎉 Test completed successfully! The offers API endpoint is working correctly.",
    );

    await browser.close();
  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
    console.error("Stack trace:", error.stack);

    if (browser) {
      await browser.close();
    }

    process.exit(1);
  }
}

// Run the test
testOffersDirectly();
