#!/usr/bin/env node

const fs = require("node:fs");
const _path = require("node:path");

// Import the MCP functions directly from TypeScript files
async function importMcpFunctions() {
  // Use dynamic import to load the TypeScript modules
  const { mcpAuthenticateWithWillys, mcpIsAuthenticated } = await import(
    "./lib/mcp-auth.ts"
  );
  const { mcpGetPickupSlots, mcpGetDeliverySlots, mcpSelectSlot } =
    await import("./lib/mcp-orders.ts");
  const { mcpSessionStore } = await import("./lib/mcp-session-store.ts");

  return {
    mcpAuthenticateWithWillys,
    mcpIsAuthenticated,
    mcpGetPickupSlots,
    mcpGetDeliverySlots,
    mcpSelectSlot,
    mcpSessionStore,
  };
}

async function testPickupFlowDirect() {
  console.log("🧪 Testing Willys Pickup Slot Selection Flow (Direct)\n");

  try {
    // Read credentials
    const credentialsPath = ".credentials";
    if (!fs.existsSync(credentialsPath)) {
      console.error("❌ .credentials file not found");
      process.exit(1);
    }

    const credentials = fs
      .readFileSync(credentialsPath, "utf8")
      .trim()
      .split("\n");
    const [username, password] = credentials;

    if (!username || !password) {
      console.error("❌ Invalid credentials format");
      process.exit(1);
    }

    // Import the functions
    const {
      mcpAuthenticateWithWillys,
      mcpIsAuthenticated,
      mcpGetPickupSlots,
      mcpGetDeliverySlots,
      mcpSelectSlot,
      mcpSessionStore,
    } = await importMcpFunctions();

    console.log("1️⃣ Logging in...");
    const sessionId = mcpSessionStore.generateSessionId();
    const loginResult = await mcpAuthenticateWithWillys(sessionId, {
      username,
      password,
    });

    if (!loginResult.success) {
      console.error("❌ Login failed:", loginResult.error);
      process.exit(1);
    }

    console.log("✅ Login successful, sessionId:", sessionId);

    // Verify authentication
    console.log("\n2️⃣ Verifying authentication...");
    const isAuthenticated = await mcpIsAuthenticated(sessionId);
    console.log("Authentication status:", isAuthenticated);

    if (!isAuthenticated) {
      console.error("❌ Authentication verification failed");
      process.exit(1);
    }

    // Test pickup slots (default store)
    console.log("\n3️⃣ Getting pickup slots for default store (2288)...");
    const pickupSlots = await mcpGetPickupSlots(sessionId);

    if (pickupSlots.success) {
      console.log("✅ Pickup slots retrieved successfully");
      console.log("Available slots:", pickupSlots.slots?.length || 0);

      if (pickupSlots.slots && pickupSlots.slots.length > 0) {
        console.log("\nFirst few pickup slots:");
        pickupSlots.slots.slice(0, 3).forEach((slot, index) => {
          console.log(`  ${index + 1}. ${slot.displayText || slot.code}`);
          console.log(`     Code: ${slot.code}`);
          if (slot.price) console.log(`     Price: ${slot.price}`);
          console.log("");
        });

        // Try to select the first available slot
        const firstSlot = pickupSlots.slots[0];
        console.log(
          `4️⃣ Attempting to select pickup slot: ${firstSlot.displayText || firstSlot.code}`,
        );

        const selectResult = await mcpSelectSlot(
          sessionId,
          firstSlot.code,
          false,
        );
        console.log("Select slot result:", selectResult);
      } else {
        console.log("⚠️  No pickup slots available");
      }
    } else {
      console.error("❌ Failed to get pickup slots:", pickupSlots.error);
    }

    // Test delivery slots
    console.log("\n5️⃣ Testing delivery slots with postal code 43136...");
    const deliverySlots = await mcpGetDeliverySlots(sessionId, "43136");

    if (deliverySlots.success) {
      console.log("✅ Delivery slots retrieved successfully");
      console.log("Available slots:", deliverySlots.slots?.length || 0);

      if (deliverySlots.slots && deliverySlots.slots.length > 0) {
        console.log("\nFirst few delivery slots:");
        deliverySlots.slots.slice(0, 3).forEach((slot, index) => {
          console.log(`  ${index + 1}. ${slot.displayText || slot.code}`);
          console.log(`     Code: ${slot.code}`);
          if (slot.price) console.log(`     Price: ${slot.price}`);
          console.log("");
        });

        // Try to select the first available delivery slot
        const firstSlot = deliverySlots.slots[0];
        console.log(
          `6️⃣ Attempting to select delivery slot: ${firstSlot.displayText || firstSlot.code}`,
        );

        const selectResult = await mcpSelectSlot(
          sessionId,
          firstSlot.code,
          true,
        );
        console.log("Select delivery slot result:", selectResult);
      } else {
        console.log("⚠️  No delivery slots available");
      }
    } else {
      console.error("❌ Failed to get delivery slots:", deliverySlots.error);
    }

    console.log("\n✅ Pickup flow test completed");
  } catch (error) {
    console.error("💥 Test failed with error:", error);
    process.exit(1);
  }
}

// Run the test
testPickupFlowDirect();
