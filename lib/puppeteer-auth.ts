import puppeteer, { type Browser, type Page } from "puppeteer";

export interface WillysSessionCookies {
  [key: string]: string;
}

export async function loginWithPuppeteer(
  username: string,
  password: string,
): Promise<WillysSessionCookies> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
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

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    );

    console.log("Navigating directly to Willys login page...");
    await page.goto("https://www.willys.se/anvandare/inloggning", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

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
      // Debug: save page content to see what's actually there
      const content = await page.content();
      console.log(
        "Page content (first 1000 chars):",
        content.substring(0, 1000),
      );
      throw new Error(
        "Username input field not found on login page after all attempts",
      );
    }

    if (!passwordInput) {
      // Debug: log all input fields on the page
      console.log("Password input not found. Debugging all input fields...");
      const allInputs = await page.$$("input");
      console.log(`Found ${allInputs.length} input fields on page`);

      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i];
        const type = await input.evaluate((el) => el.getAttribute("type"));
        const name = await input.evaluate((el) => el.getAttribute("name"));
        const id = await input.evaluate((el) => el.getAttribute("id"));
        const className = await input.evaluate((el) =>
          el.getAttribute("class"),
        );
        const placeholder = await input.evaluate((el) =>
          el.getAttribute("placeholder"),
        );
        console.log(
          `Input ${i + 1}: type="${type}", name="${name}", id="${id}", class="${className}", placeholder="${placeholder}"`,
        );
      }

      throw new Error(
        "Password input field not found on login page - see debug info above",
      );
    }

    console.log("Filling in credentials...");
    await usernameInput.type(username);
    await passwordInput.type(password);

    console.log("Submitting login form...");

    // Find the "Logga in" button by text content (most reliable method)
    let loginButton = null;
    const buttons = await page.$$("button");
    console.log(`Found ${buttons.length} total buttons on page`);

    for (let i = 0; i < buttons.length; i++) {
      try {
        const btn = buttons[i];
        const text = await btn.evaluate((el) => el.textContent?.trim());
        const visible = await btn.evaluate((el) => el.offsetParent !== null);

        if (text?.includes("Logga in") && visible) {
          loginButton = btn;
          console.log(`✅ Found login button: "${text}"`);
          break;
        }
      } catch (_e) {
        // Continue to next button
      }
    }

    if (loginButton) {
      console.log("Clicking login button...");

      // Scroll button into view first (crucial for success!)
      await loginButton.scrollIntoView();
      await new Promise((resolve) => setTimeout(resolve, 500));

      await loginButton.click();
      console.log("✅ Login button clicked");

      // Wait a moment and verify the button disappeared (indicates success)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const stillVisible = await loginButton
        .evaluate((el) => {
          return el.offsetParent !== null && el.isConnected;
        })
        .catch(() => false);

      if (!stillVisible) {
        console.log("🎉 Login button disappeared - login likely successful!");
      } else {
        console.log("⚠️ Login button still visible - login may have failed");
      }
    } else {
      console.log("❌ No login button found! Trying Enter key as fallback...");
      await page.focus('input[name="j_password"]');
      await page.keyboard.press("Enter");
    }

    // Wait for modal to close (indicating successful login)
    try {
      await page.waitForFunction(
        () =>
          !document.querySelector('input[name="j_username"]') ||
          !document.querySelector('input[name="j_password"]'),
        { timeout: 10000 },
      );
      console.log("Login modal closed - login appears successful!");
    } catch (_e) {
      console.log("Modal didn't close within timeout - login may have failed");
    }

    // Wait for login to process
    console.log("Waiting for login to complete...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify login was successful by testing the orders API
    console.log("Verifying login success...");

    const response = await page.goto(
      "https://www.willys.se/axfood/rest/account/orders",
      {
        waitUntil: "networkidle0",
        timeout: 15000,
      },
    );

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

    const sessionCookies: WillysSessionCookies = {};
    for (const cookie of cookies) {
      sessionCookies[cookie.name] = cookie.value;
    }

    console.log(
      `Successfully logged in and extracted ${Object.keys(sessionCookies).length} cookies`,
    );
    return sessionCookies;
  } catch (error) {
    console.error("Puppeteer login error:", error);
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}
