const puppeteer = require("puppeteer");

async function testPuppeteerLogin() {
  const username = "198202242973";
  const password = "9nR%dHV6V7QsmYPX^pXuPvcjx9y6jx";

  let browser = null;
  let page = null;

  try {
    console.log("Starting Puppeteer test...");
    browser = await puppeteer.launch({
      headless: false, // Make it visible so we can see what happens
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    page = await browser.newPage();

    // Clear any existing cookies/session to ensure we get the actual login page
    console.log("Clearing cookies and cache to ensure fresh session...");
    await page.deleteCookie(...(await page.cookies()));

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    );

    console.log("Navigating to Willys login page...");
    await page.goto("https://www.willys.se/anvandare/inloggning", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Debug: Check current URL and page info after navigation
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`Current URL after navigation: ${currentUrl}`);
    console.log(`Page title: ${pageTitle}`);

    // Check if we're on the home page (might be logged in already)
    const pageContent = await page.content();
    if (pageContent.includes("Sök i e-handeln")) {
      console.log("⚠️ We seem to be on the main shopping page, not login page!");
      console.log(
        "Trying to find login button or link to navigate to actual login form...",
      );

      // Try to find login button/link
      const loginSelectors = [
        'a[href*="inloggning"]',
        'button:contains("Logga in")',
        'a:contains("Logga in")',
        '[data-testid*="login"]',
        ".login",
        "#login",
        'a[href*="login"]',
      ];

      for (const selector of loginSelectors) {
        try {
          const loginElement = await page.$(selector);
          if (loginElement) {
            console.log(`Found login element with selector: ${selector}`);
            await loginElement.click();
            await new Promise((resolve) => setTimeout(resolve, 2000));
            break;
          }
        } catch (_e) {
          // Continue to next selector
        }
      }
    }

    // Handle cookie banner first
    console.log("Checking for cookie banner...");
    try {
      // Wait a bit for the cookie banner to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Try multiple common cookie banner selectors
      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="cookie"]',
        'button[class*="cookie"]',
        'button:contains("Acceptera")',
        'button:contains("Accept")',
        'button:contains("Godkänn")',
        '[data-testid*="accept"]',
        '[data-cy*="accept"]',
        ".cookie-banner button",
        "#cookie-banner button",
        '[role="dialog"] button',
        ".modal button:first-child",
      ];

      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            console.log(
              `Found cookie banner button with selector: ${selector}`,
            );
            await button.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            break;
          }
        } catch (_selectorError) {
          // Continue to next selector
        }
      }

      // Don't press Escape as it might close the login modal
      console.log("Cookie banner handling completed.");
    } catch (error) {
      console.log(
        "Cookie banner handling completed with potential issues:",
        error,
      );
    }

    console.log("Looking for login form inputs...");

    // Wait longer after cookie banner handling for form to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Wait for the specific login form to be present
    console.log("Waiting for login form to fully load...");
    try {
      await page.waitForSelector(
        'form, input[type="text"], input[type="password"]',
        {
          timeout: 10000,
        },
      );
    } catch (_e) {
      console.log("Timeout waiting for form elements, continuing anyway...");
    }

    // DEBUG: Log all input fields on the page
    console.log("=== DEBUGGING ALL INPUT FIELDS ===");
    const allInputs = await page.$$("input");
    console.log(`Found ${allInputs.length} input fields on page`);

    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const type = await input
        .getProperty("type")
        .then((p) => p.jsonValue())
        .catch(() => null);
      const name = await input
        .getProperty("name")
        .then((p) => p.jsonValue())
        .catch(() => null);
      const id = await input
        .getProperty("id")
        .then((p) => p.jsonValue())
        .catch(() => null);
      const className = await input
        .getProperty("className")
        .then((p) => p.jsonValue())
        .catch(() => null);
      const placeholder = await input
        .getProperty("placeholder")
        .then((p) => p.jsonValue())
        .catch(() => null);
      console.log(
        `Input ${i + 1}: type="${type}", name="${name}", id="${id}", class="${className}", placeholder="${placeholder}"`,
      );
    }
    console.log("=== END DEBUG ===");

    let usernameInput = null;
    let passwordInput = null;

    // Try to find BOTH inputs together with a more patient approach
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`Attempt ${attempt + 1} to find login inputs...`);

      // First try the known working selectors
      usernameInput =
        (await page.$('input[name="j_username"]')) ||
        (await page.$('input[type="text"]')) ||
        (await page.$('input[name="username"]'));

      passwordInput =
        (await page.$('input[name="j_password"]')) ||
        (await page.$('input[type="password"]')) ||
        (await page.$('input[name="password"]'));

      if (usernameInput && passwordInput) {
        console.log("Found both username and password inputs!");
        break;
      }

      console.log(
        `Found username: ${!!usernameInput}, password: ${!!passwordInput}`,
      );

      // Wait between attempts and try interacting with page to trigger any dynamic loading
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        // Try scrolling or clicking to trigger any lazy loading
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!usernameInput) {
      throw new Error(
        "Username input field not found on login page after all attempts",
      );
    }

    if (!passwordInput) {
      throw new Error(
        "Password input field not found on login page - see debug info above",
      );
    }

    console.log("Filling in credentials...");
    await usernameInput.type(username);
    await passwordInput.type(password);

    // Verify the credentials were typed correctly
    const typedUsername = await usernameInput.evaluate((el) => el.value);
    const typedPassword = await passwordInput.evaluate((el) => el.value);
    console.log(`Typed username: "${typedUsername}" (expected: "${username}")`);
    console.log(`Typed password: "${typedPassword}" (expected: "${password}")`);

    console.log("Submitting login form...");

    // Find the login button by searching for "Logga in" text
    let loginButton = null;

    console.log("Searching for 'Logga in' button...");

    // Use XPath to find button by text content
    try {
      const xpathButtons = await page.$x(
        "//button[contains(text(), 'Logga in')]",
      );
      if (xpathButtons.length > 0) {
        loginButton = xpathButtons[0];
        console.log(
          `Found login button via XPath (found ${xpathButtons.length} matches)`,
        );
      }
    } catch (e) {
      console.log("XPath search failed:", e.message);
    }

    // Fallback: manual search through all buttons
    if (!loginButton) {
      console.log("XPath failed, manually searching all buttons...");
      const buttons = await page.$$("button");
      console.log(`Found ${buttons.length} total buttons on page`);

      for (let i = 0; i < buttons.length; i++) {
        try {
          const btn = buttons[i];
          const text = await btn.evaluate((el) => el.textContent?.trim());
          const visible = await btn.evaluate((el) => el.offsetParent !== null);
          console.log(`Button ${i + 1}: "${text}" (visible: ${visible})`);

          if (text?.includes("Logga in") && visible) {
            loginButton = btn;
            console.log(`✅ Found login button: "${text}"`);
            break;
          }
        } catch (e) {
          console.log(`Error checking button ${i + 1}:`, e.message);
        }
      }
    }

    if (loginButton) {
      console.log("Clicking login button...");

      // Make sure the button is visible and enabled before clicking
      const buttonState = await loginButton.evaluate((el) => ({
        visible: el.offsetParent !== null,
        disabled: el.disabled,
        ariaDisabled: el.getAttribute("aria-disabled"),
        text: el.textContent?.trim(),
      }));
      console.log("Button state:", buttonState);

      // Try clicking the button and verify it works
      try {
        console.log("Attempting to click login button...");

        // Scroll button into view first
        await loginButton.scrollIntoView();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Try different click approaches
        console.log("Method 1: Normal Puppeteer click...");
        await loginButton.click();
        console.log("✅ Normal click completed");

        // Wait and check if it worked
        await new Promise((resolve) => setTimeout(resolve, 500));
        let stillVisible = await loginButton
          .evaluate((el) => {
            return el.offsetParent !== null && el.isConnected;
          })
          .catch(() => false);

        if (stillVisible) {
          console.log("Normal click didn't work, trying JavaScript click...");
          await loginButton.evaluate((el) => el.click());
          await new Promise((resolve) => setTimeout(resolve, 500));

          stillVisible = await loginButton
            .evaluate((el) => {
              return el.offsetParent !== null && el.isConnected;
            })
            .catch(() => false);
        }

        if (stillVisible) {
          console.log(
            "JavaScript click didn't work, trying mouse click with coordinates...",
          );
          const box = await loginButton.boundingBox();
          if (box) {
            await page.mouse.click(
              box.x + box.width / 2,
              box.y + box.height / 2,
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        // Wait a moment for the click to process
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if the button is still visible (it should disappear if login works)
        const finalVisibility = await loginButton
          .evaluate((el) => {
            return el.offsetParent !== null && el.isConnected;
          })
          .catch(() => false);

        console.log(`Button still visible after click: ${finalVisibility}`);

        if (!finalVisibility) {
          console.log("🎉 Login button disappeared - login likely successful!");
        } else {
          console.log("⚠️ Login button still visible - login may have failed");
        }
      } catch (e) {
        console.log("❌ Click failed:", e.message);
      }

      // Wait a bit more for any changes
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check for any error messages in the modal
      const errorElements = await page.$$(
        '.error, [class*="error"], [class*="Error"], .invalid, [class*="invalid"]',
      );
      for (const errorEl of errorElements) {
        try {
          const errorText = await errorEl.evaluate((el) =>
            el.textContent?.trim(),
          );
          if (errorText) {
            console.log(`⚠️ Found potential error message: "${errorText}"`);
          }
        } catch (_e) {
          // Continue
        }
      }
    } else {
      console.log("❌ No login button found! Trying Enter key as fallback...");
      await passwordInput.focus();
      await page.keyboard.press("Enter");
    }

    // Wait for login to process and modal to close
    console.log("Waiting for login to complete...");

    // Wait for either navigation or modal to disappear
    try {
      // Wait for modal to close (login inputs should disappear)
      await page.waitForFunction(
        () =>
          !document.querySelector('input[name="j_username"]') ||
          !document.querySelector('input[name="j_password"]'),
        { timeout: 10000 },
      );
      console.log("Login modal closed - login appears successful!");
    } catch (_e) {
      console.log("Modal didn't close within timeout, continuing anyway...");
    }

    // Additional wait for any redirects/updates
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify login was successful by testing the orders API
    console.log("Verifying login success...");

    // First check current page URL to see if we're logged in
    const postLoginUrl = page.url();
    console.log(`Current URL after login: ${postLoginUrl}`);

    // Navigate directly to orders API endpoint
    const response = await page.goto(
      "https://www.willys.se/axfood/rest/account/orders",
      {
        waitUntil: "networkidle0",
        timeout: 15000,
      },
    );

    console.log(`Orders API response status: ${response?.status()}`);

    if (!response || response.status() !== 200) {
      throw new Error(
        `Orders API returned status: ${response?.status() || "unknown"}`,
      );
    }

    const content = await page.content();

    // Check if we got a "not logged in" response
    if (content.includes('"customerLoggedIn":"false"')) {
      throw new Error("Login failed: Invalid username or password");
    }

    // Check if we got an error response
    if (content.includes("unauthorized") || content.includes("error")) {
      throw new Error("Login failed: Authentication error");
    }

    // Extract cookies
    console.log("Extracting session cookies...");
    const cookies = await page.cookies("https://www.willys.se");

    const sessionCookies = {};
    for (const cookie of cookies) {
      sessionCookies[cookie.name] = cookie.value;
    }

    console.log(
      `✅ Successfully logged in and extracted ${Object.keys(sessionCookies).length} cookies`,
    );
    console.log("Cookies:", sessionCookies);

    return sessionCookies;
  } catch (error) {
    console.error("❌ Puppeteer login error:", error);
    throw error;
  } finally {
    if (page) {
      console.log("Closing page...");
      await page.close();
    }
    if (browser) {
      console.log("Closing browser...");
      await browser.close();
    }
  }
}

// Run the test
testPuppeteerLogin().catch(console.error);
