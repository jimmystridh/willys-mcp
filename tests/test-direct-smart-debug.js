const {
  mcpWillysLogin,
  mcpGetOrders,
  mcpGetOrderDetails,
  mcpGetSmartProductMatches,
} = require("./lib/mcp-orders");

async function testDirectSmartMatching() {
  try {
    console.log("🚀 Testing direct smart product matching...");

    // Login
    console.log("📝 Step 1: Logging in...");
    const sessionId = "nf44gmtetnjmeyow76h"; // Using existing session
    console.log(`✅ Using session: ${sessionId}`);

    // Get orders
    console.log("📝 Step 2: Getting orders...");
    const orders = await mcpGetOrders(sessionId);
    console.log(`✅ Found ${orders.length} orders`);

    // Get details for first few orders to test the corrected API
    console.log("📝 Step 3: Testing corrected orderdata API...");
    for (let i = 0; i < Math.min(3, orders.length); i++) {
      const order = orders[i];
      console.log(`📦 Testing order ${order.orderNumber || order.code}...`);

      try {
        const details = await mcpGetOrderDetails(
          sessionId,
          order.orderNumber || order.code,
        );
        console.log(`✅ Order details retrieved successfully`);

        // Check if we have categoryOrderedDeliveredProducts
        if (details.categoryOrderedDeliveredProducts) {
          console.log(
            `📊 Found ${details.categoryOrderedDeliveredProducts.length} categories`,
          );
          let totalProducts = 0;
          details.categoryOrderedDeliveredProducts.forEach((category) => {
            if (category.products) {
              totalProducts += category.products.length;
            }
          });
          console.log(`📦 Total products in this order: ${totalProducts}`);

          // Show first few products for verification
          if (totalProducts > 0) {
            const firstCategory = details.categoryOrderedDeliveredProducts.find(
              (cat) => cat.products && cat.products.length > 0,
            );
            if (firstCategory) {
              console.log(
                `📋 Sample products from ${firstCategory.categoryName}:`,
              );
              firstCategory.products.slice(0, 3).forEach((product) => {
                console.log(`   - ${product.name} (${product.code})`);
              });
            }
          }
        } else {
          console.log("⚠️  No categoryOrderedDeliveredProducts found");
          console.log("📄 Order details keys:", Object.keys(details));
        }

        break; // Only test one successful order
      } catch (error) {
        console.log(
          `❌ Failed to get details for order ${order.orderNumber || order.code}: ${error.message}`,
        );
      }
    }

    // Test smart matching
    console.log("📝 Step 4: Testing smart product matching...");
    const matches = await mcpGetSmartProductMatches(sessionId, "mjölk", 5);
    console.log("🎯 Smart matching result:", matches);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

testDirectSmartMatching();
