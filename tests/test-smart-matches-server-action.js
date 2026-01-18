// Test script to verify smart product matching server action works
const { getSmartProductMatches } = require("./actions/orders");

async function testSmartMatches() {
  console.log("Testing smart product matching server action...");

  try {
    // Test with a common Swedish grocery term
    const result = await getSmartProductMatches("mjölk", 3);

    console.log("Result:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("✅ Success! Found", result.matches.length, "matches");
      if (result.matches.length > 0) {
        console.log("Top match:", result.matches[0].product.name);
        console.log("Score:", result.matches[0].score);
        console.log("Frequency:", result.matches[0].frequency);
      }
    } else {
      console.log("❌ Failed:", result.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Run the test
testSmartMatches();
