#!/usr/bin/env node

const fs = require("node:fs");

// Helper function to make MCP HTTP requests
async function callMCPTool(toolName, params) {
  const response = await fetch("http://localhost:3000/api/mcp/http", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`MCP error: ${result.error.message}`);
  }

  return result.result;
}

async function testPickupFlow() {
  console.log("🧪 Testing Willys Pickup Slot Selection Flow\n");

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

    console.log("1️⃣ Logging in...");
    const loginResult = await callMCPTool("mcp__willys_login", {
      username,
      password,
    });

    console.log("Raw login response:", JSON.stringify(loginResult, null, 2));

    // Extract session ID from response text
    const sessionIdMatch = loginResult.content?.[0]?.text?.match(
      /Session ID: ([a-f0-9-]+)/,
    );
    if (!sessionIdMatch) {
      console.error("❌ Failed to extract session ID from login response");
      process.exit(1);
    }

    const sessionId = sessionIdMatch[1];
    console.log("✅ Login successful, sessionId:", sessionId);

    // Verify authentication
    console.log("\n2️⃣ Verifying authentication...");
    const authCheck = await callMCPTool("mcp__willys_check_auth", {
      sessionId,
    });
    console.log("Auth status:", authCheck);

    // Test pickup slots (default store)
    console.log("\n3️⃣ Getting pickup slots for default store (2288)...");
    const pickupSlots = await callMCPTool("mcp__willys_get_pickup_slots", {
      sessionId,
    });

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

        const selectResult = await callMCPTool("mcp__willys_select_slot", {
          sessionId,
          slotCode: firstSlot.code,
          isTmsSlot: false,
        });
        console.log("Select slot result:", selectResult);
      } else {
        console.log("⚠️  No pickup slots available");
      }
    } else {
      console.error("❌ Failed to get pickup slots:", pickupSlots.error);
    }

    // Test delivery slots
    console.log("\n5️⃣ Testing delivery slots with postal code 43136...");
    const deliverySlots = await callMCPTool("mcp__willys_get_delivery_slots", {
      sessionId,
      postalCode: "43136",
    });

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

        const selectResult = await callMCPTool("mcp__willys_select_slot", {
          sessionId,
          slotCode: firstSlot.code,
          isTmsSlot: true,
        });
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
testPickupFlow();
