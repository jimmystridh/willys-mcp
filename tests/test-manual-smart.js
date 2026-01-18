#!/usr/bin/env node

// Manual test instruction generator
console.log("🧪 MANUAL TEST INSTRUCTIONS FOR SMART PRODUCT MATCHING");
console.log("=".repeat(60));
console.log();
console.log("1. Make sure the dev server is running: npm run dev");
console.log("2. Open browser and go to: http://localhost:3001");
console.log("3. Login with your Willys credentials if prompted");
console.log("4. Navigate to: http://localhost:3001/orders");
console.log('5. Look for "Smart Product Matcher" section');
console.log('6. Enter a search term like "mjölk" or "bröd" or "halloumi"');
console.log('7. Click the "Find" button');
console.log("8. Check for results and any errors in:");
console.log("   - Browser console (F12)");
console.log("   - Server terminal logs");
console.log();
console.log("EXPECTED BEHAVIOR:");
console.log("- Should show smart matches based on purchase history");
console.log("- Should display product names, scores, frequency data");
console.log('- Should handle "no matches found" gracefully');
console.log();
console.log("POTENTIAL ISSUES TO CHECK:");
console.log("- Authentication errors (cookies/session)");
console.log("- API fetch failures");
console.log("- Order history processing errors");
console.log("- JavaScript errors in browser console");
console.log();

// Quick server check
const http = require("node:http");

const req = http.request(
  {
    hostname: "localhost",
    port: 3001,
    path: "/orders",
    method: "GET",
  },
  (res) => {
    if (res.statusCode === 200) {
      console.log("✅ Server is running and orders page is accessible");
    } else if (res.statusCode === 307 || res.statusCode === 302) {
      console.log(
        "🔄 Server redirects to login (expected if not authenticated)",
      );
    } else {
      console.log(`⚠️  Server returned status: ${res.statusCode}`);
    }
  },
);

req.on("error", (e) => {
  console.log("❌ Server not accessible:", e.message);
  console.log("   Make sure to run: npm run dev");
});

req.end();
