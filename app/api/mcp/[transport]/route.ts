import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  mcpAuthenticateWithWillys,
  mcpIsAuthenticated,
  mcpLogout,
} from "@/lib/mcp-auth";
import {
  mcpAddToCart,
  mcpCheckout,
  mcpGetCart,
  mcpGetCommonProducts,
  mcpGetCustomerInfo,
  mcpGetDeliverySlots,
  mcpGetOffers,
  mcpGetOrderDetails,
  mcpGetOrders,
  mcpGetPickupSlots,
  mcpGetProductDetail,
  mcpGetSearchSuggestions,
  mcpGetSmartProductMatches,
  mcpRemoveFromCart,
  mcpSearchProducts,
  mcpSelectSlot,
} from "@/lib/mcp-orders";
import { mcpSessionStore } from "@/lib/mcp-session-store";

/**
 * MCP Server for Willys Grocery Operations
 * Provides tools for managing orders, cart, and delivery slots with session-based authentication
 *
 * Authentication Flow:
 * 1. Call mcp__willys_login with credentials to get a sessionId
 * 2. Use the sessionId in subsequent tool calls for authentication
 * 3. The server manages session persistence across tool calls
 */
const handler = createMcpHandler(
  (server) => {
    // Authentication Tools
    server.tool(
      "mcp__willys_login",
      "Login to Willys with username and password. Returns a sessionId that must be used in subsequent tool calls.",
      {
        username: z.string().describe("Willys username/email"),
        password: z.string().describe("Willys password"),
      },
      async ({ username, password }) => {
        try {
          const sessionId = mcpSessionStore.generateSessionId();
          const result = await mcpAuthenticateWithWillys(sessionId, {
            username,
            password,
          });

          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Successfully logged in to Willys. Session ID: ${sessionId}\n\nUse this sessionId in all subsequent tool calls for authentication.`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Login failed: ${result.error || "Invalid credentials"}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Login error: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_logout",
      "Logout from Willys and clear authentication session",
      {
        sessionId: z.string().describe("Session ID to logout"),
      },
      async ({ sessionId }) => {
        try {
          await mcpLogout(sessionId);
          return {
            content: [
              {
                type: "text",
                text: "✅ Successfully logged out from Willys",
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Logout error: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_check_auth",
      "Check if currently authenticated with Willys",
      {
        sessionId: z.string().describe("Session ID to check"),
      },
      async ({ sessionId }) => {
        try {
          const authenticated = await mcpIsAuthenticated(sessionId);
          return {
            content: [
              {
                type: "text",
                text: authenticated
                  ? "✅ Currently authenticated with Willys"
                  : "❌ Not authenticated with Willys",
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Authentication check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Order Management Tools
    server.tool(
      "mcp__willys_get_orders",
      "Fetch the user's Willys order history using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
      },
      async ({ sessionId }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const orders = await mcpGetOrders(sessionId);

          if (orders.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "No orders found. Make sure you're logged in with the correct credentials.",
                },
              ],
            };
          }

          const ordersList = orders
            .map(
              (order) =>
                `• Order #${order.orderNumber} - ${order.deliveryDate} - ${order.status} - ${order.total} kr`,
            )
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `📦 Found ${orders.length} orders:\n\n${ordersList}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch orders: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_get_order_details",
      "Get detailed information about a specific Willys order including all items using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        orderNumber: z.string().describe("The order number to get details for"),
      },
      async ({ sessionId, orderNumber }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const order = await mcpGetOrderDetails(sessionId, orderNumber);

          if (!order) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Order #${orderNumber} not found or failed to load.`,
                },
              ],
            };
          }

          const itemsList =
            order.items
              ?.map(
                (item) =>
                  `• ${item.name} - Qty: ${item.quantity} - ${item.price} kr - ${item.brand || "No brand"} - ${item.category || "No category"}`,
              )
              .join("\n") || "No items found";

          return {
            content: [
              {
                type: "text",
                text:
                  `📋 Order #${order.orderNumber} Details:\n` +
                  `📅 Delivery: ${order.deliveryDate || "Date not available"}\n` +
                  `📊 Status: ${order.status}\n` +
                  `💰 Total: ${order.total} kr\n` +
                  `📦 Items (${order.items?.length || 0}):\n\n${itemsList}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch order details: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_add_to_cart",
      "Add a product to the Willys cart by product code using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        productCode: z
          .string()
          .describe("The Willys product code (e.g., '101280149_ST')"),
        quantity: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Quantity to add to cart (default: 1)"),
      },
      async ({ sessionId, productCode, quantity = 1 }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpAddToCart(sessionId, productCode, quantity);

          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Successfully added ${quantity}x product ${productCode} to cart!`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to add product to cart: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to add to cart: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Customer Information Tools
    server.tool(
      "mcp__willys_get_customer_info",
      "Fetch customer profile information including bonus data and addresses using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
      },
      async ({ sessionId }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const customerInfo = await mcpGetCustomerInfo(sessionId);

          if (!customerInfo) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Failed to fetch customer information.",
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `👤 Customer Information:\n` +
                  `📛 Name: ${customerInfo.name}\n` +
                  `📧 Email: ${customerInfo.email}\n` +
                  `🆔 Display ID: ${customerInfo.displayUid}\n` +
                  `💰 This Month's Savings: ${customerInfo.bonusInfo.totalDiscountCurrentMonth}\n` +
                  `💰 This Year's Savings: ${customerInfo.bonusInfo.totalDiscountCurrentYear}\n` +
                  `🏆 Bonus Tier: ${customerInfo.bonusInfo.currentTierName}\n` +
                  `🏠 Default Address: ${customerInfo.defaultShippingAddress?.formattedAddress || "Not set"}\n` +
                  `📅 Member Since: ${customerInfo.memberCreationMonthAndYear}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch customer info: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_get_offers",
      "Fetch current offers and promotions from Willys using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
      },
      async ({ sessionId }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const offers = await mcpGetOffers(sessionId);

          if (!offers.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to fetch offers: ${offers.message}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `🏷️ Willys Offers Retrieved Successfully!\n\n` +
                  `📊 Data Structure: ${JSON.stringify(offers.offers, null, 2).substring(0, 1000)}...` +
                  `\n\n✅ Use this data to parse and display current offers and promotions.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch offers: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_get_cart",
      "Get current cart contents and pricing information using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
      },
      async ({ sessionId }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const cart = await mcpGetCart(sessionId);

          if (!cart) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Failed to fetch cart information.",
                },
              ],
            };
          }

          if (cart.products.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "🛒 Cart is empty",
                },
              ],
            };
          }

          const productsList = cart.products
            .map(
              (product) =>
                `• ${product.name} - ${product.manufacturer} - Qty: ${product.pickQuantity} - ${product.totalDiscountedPrice}`,
            )
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text:
                  `🛒 Cart Contents (${cart.totalItems} items):\n\n${productsList}\n\n` +
                  `💰 Subtotal: ${cart.subTotalPrice}\n` +
                  `🚚 Delivery: ${cart.deliveryCost || "0,00 kr"}\n` +
                  `🏷️ Tax: ${cart.totalTax}\n` +
                  `💳 Total: ${cart.totalPrice}\n` +
                  `📅 Order Date: ${cart.orderDate}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch cart: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Delivery and Pickup Tools
    server.tool(
      "mcp__willys_get_delivery_slots",
      "Get available delivery time slots for a postal code using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        postalCode: z.string().describe("Swedish postal code (e.g., '43136')"),
      },
      async ({ sessionId, postalCode }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const slotsData = await mcpGetDeliverySlots(sessionId, postalCode);

          if (!slotsData || slotsData.deliveryDays.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ No delivery slots available for postal code ${postalCode}.`,
                },
              ],
            };
          }

          const slotsText = slotsData.deliveryDays
            .map((day) => {
              const availableSlots = day.slots.filter(
                (slot) =>
                  slot.available && !slot.fullyBooked && !slot.limitReached,
              );
              if (availableSlots.length === 0)
                return `📅 ${day.formattedDate}: No available slots`;

              const slotsList = availableSlots
                .map(
                  (slot) =>
                    `  • ${slot.formattedTime} - ${slot.totalCost} (ID: ${slot.slotId})`,
                )
                .join("\n");

              return `📅 ${day.formattedDate}:\n${slotsList}`;
            })
            .join("\n\n");

          return {
            content: [
              {
                type: "text",
                text: `🚚 Available Delivery Slots for ${postalCode}:\n\n${slotsText}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch delivery slots: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_get_pickup_slots",
      "Get available store pickup time slots using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        storeId: z
          .string()
          .default("2288")
          .describe("Store ID for pickup (default: '2288')"),
      },
      async ({ sessionId, storeId = "2288" }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const slotsData = await mcpGetPickupSlots(sessionId, storeId);

          if (!slotsData || slotsData.slots.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ No pickup slots available for store ${storeId}.`,
                },
              ],
            };
          }

          const availableSlots = slotsData.slots.filter(
            (slot) => slot.available,
          );
          if (availableSlots.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ No available pickup slots for store ${storeId}.`,
                },
              ],
            };
          }

          const slotsList = availableSlots
            .map(
              (slot) =>
                `• ${slot.formattedTime} - ${slot.totalCost.formattedValue} (Code: ${slot.code})`,
            )
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `🏪 Available Pickup Slots for Store ${storeId}:\n\n${slotsList}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch pickup slots: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_select_slot",
      "Book a specific delivery or pickup time slot using session-based authentication and TMS data for delivery slots.",
      {
        sessionId: z.string().describe("Session ID from login"),
        slotCode: z
          .string()
          .describe(
            "The slot code/ID to book (e.g., '2288_Collect_250901_1200_1330_53257734482927')",
          ),
        isTmsSlot: z
          .boolean()
          .default(false)
          .describe(
            "Whether this is a TMS delivery slot (true) or pickup slot (false)",
          ),
      },
      async ({ sessionId, slotCode, isTmsSlot = false }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          // For TMS slots, we would need additional TMS data, but we'll attempt with the basic call
          const result = await mcpSelectSlot(sessionId, slotCode, isTmsSlot);

          if (result.success) {
            const slotType = isTmsSlot ? "delivery" : "pickup";
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Successfully booked ${slotType} slot: ${slotCode}`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to book slot: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to select slot: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Remove product from cart
    server.tool(
      "mcp__willys_remove_from_cart",
      "Remove a product from the Willys cart by setting quantity to 0 using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        productCode: z
          .string()
          .describe("The Willys product code to remove (e.g., '101280149_ST')"),
      },
      async ({ sessionId, productCode }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpRemoveFromCart(sessionId, productCode);

          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Successfully removed product ${productCode} from cart!`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to remove product: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to remove product from cart: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Checkout
    server.tool(
      "mcp__willys_checkout",
      "Initiate checkout process for the current Willys cart using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
      },
      async ({ sessionId }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpCheckout(sessionId);

          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: result.emptyCart
                    ? "⚠️ Cart is empty - nothing to checkout"
                    : "✅ Checkout process initiated successfully!",
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to checkout: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to checkout: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Search Tools
    server.tool(
      "mcp__willys_search",
      "Search for products on Willys using session-based authentication. Returns clean JSON product data.",
      {
        sessionId: z.string().describe("Session ID from login"),
        query: z
          .string()
          .describe("Search query (e.g., 'mjölk', 'bröd', 'äpplen')"),
        page: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Page number (0-based, default: 0)"),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(30)
          .describe("Number of results per page (default: 30)"),
      },
      async ({ sessionId, query, page = 0, size = 30 }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpSearchProducts(sessionId, query, page, size);

          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Search failed: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }

          interface SearchProduct {
            name: string;
            code: string;
            price: string;
            manufacturer?: string;
            categoryName?: string;
            stock?: { stockLevelStatus?: string };
            volume?: string;
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `🔍 Search Results for "${query}" (page ${page + 1}):\n\n` +
                  `Found ${result.totalResults || 0} products:\n\n` +
                  ((result.products as SearchProduct[] | undefined)
                    ?.slice(0, 5)
                    .map(
                      (product, index) =>
                        `${index + 1}. **${product.name}**\n` +
                        `   Code: ${product.code}\n` +
                        `   Price: ${product.price}\n` +
                        `   Brand: ${product.manufacturer || "Unknown"}\n` +
                        `   Category: ${product.categoryName || "Unknown"}\n` +
                        `   Stock: ${product.stock?.stockLevelStatus || "unknown"}\n` +
                        `   Volume: ${product.volume || "N/A"}`,
                    )
                    .join("\n\n") || "No products found") +
                  ((result.products?.length ?? 0) > 5
                    ? `\n\n... and ${(result.products?.length ?? 0) - 5} more products`
                    : "") +
                  `\n\n📊 Products returned as clean JSON structure with: name, code, price, manufacturer, categoryName, stock, image, volume, etc.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_search_suggestions",
      "Get search suggestions/autocomplete for a search term using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        term: z
          .string()
          .describe(
            "Search term to get suggestions for (e.g., 'mjö' for 'mjölk')",
          ),
      },
      async ({ sessionId, term }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpGetSearchSuggestions(sessionId, term);

          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to get suggestions: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `💡 Search Suggestions for "${term}":\n\n` +
                  `📊 Suggestions Data: ${JSON.stringify(result.suggestions, null, 2)}\n\n` +
                  `✅ Use these suggestions to help users find relevant products.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to get search suggestions: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    server.tool(
      "mcp__willys_get_common_products",
      "Get the user's most frequently purchased products (personalized recommendations) using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
      },
      async ({ sessionId }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpGetCommonProducts(sessionId);

          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to get common products: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `📦 Your Most Common Products Retrieved Successfully!\n\n` +
                  `📊 Page Data: ${JSON.stringify(result.commonProducts, null, 2).substring(0, 1000)}...` +
                  `\n\n✅ This contains personalized product recommendations based on your purchase history.\n` +
                  `💡 Parse the contentSlots data to extract product recommendations and personalized offers.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to get common products: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Get product detail
    server.tool(
      "mcp__willys_get_product_detail",
      "Get detailed information about a specific product including price, description, and availability using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        productCode: z
          .string()
          .describe("The Willys product code (e.g., '101245382_ST')"),
        productName: z
          .string()
          .optional()
          .describe(
            "Optional product name for URL (will be generated if not provided)",
          ),
      },
      async ({ sessionId, productCode, productName }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpGetProductDetail(
            sessionId,
            productCode,
            productName,
          );

          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to get product detail: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }

          const productDetail = result.productDetail;
          let responseText = `✅ Successfully retrieved product detail for ${productCode}\n\n`;

          // Add summary of the response
          if (
            productDetail &&
            typeof productDetail === "object" &&
            "pageProps" in productDetail
          ) {
            responseText += `📄 Product detail page data received\n`;
            responseText += `📊 Response structure: ${JSON.stringify(productDetail, null, 2).substring(0, 1000)}`;
            if (JSON.stringify(productDetail, null, 2).length > 1000) {
              responseText +=
                "\n\n... (response truncated, full data available in productDetail object)";
            }
          } else {
            responseText += `📦 Product detail data: ${JSON.stringify(productDetail, null, 2)}`;
          }

          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to get product detail: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );

    // Get smart product matches based on purchase history
    server.tool(
      "mcp__willys_get_smart_product_matches",
      "Get intelligently ranked product matches for a search term based on purchase history, frequency, and recency using session-based authentication.",
      {
        sessionId: z.string().describe("Session ID from login"),
        searchTerm: z
          .string()
          .describe(
            "Search term to find products (e.g., 'mjölk', 'bröd', 'äpplen')",
          ),
        maxResults: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of results to return (default: 5)"),
      },
      async ({ sessionId, searchTerm, maxResults = 5 }) => {
        try {
          // Check authentication first
          const authenticated = await mcpIsAuthenticated(sessionId);
          if (!authenticated) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Not authenticated. Please login first using mcp__willys_login.",
                },
              ],
            };
          }

          const result = await mcpGetSmartProductMatches(
            sessionId,
            searchTerm,
            maxResults,
          );

          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Failed to get smart product matches: ${result.message || "Unknown error"}`,
                },
              ],
            };
          }

          interface ProductMatch {
            product: {
              name: string;
              code: string;
              price?: string;
            };
            score: number;
            frequency: number;
            recentPurchases: number;
            lastPurchased: string;
          }

          const matches = (result.matches || []) as ProductMatch[];
          let responseText = `✅ Smart matches for "${searchTerm}":\n\n`;

          if (matches.length === 0) {
            responseText += "No matches found for your search term.";
          } else {
            matches.forEach((match, index) => {
              const product = match.product;
              const scoreInfo =
                match.score > 0
                  ? `(Score: ${match.score.toFixed(1)}, Freq: ${match.frequency}, Recent: ${match.recentPurchases}, Last: ${match.lastPurchased})`
                  : `(Search result)`;

              responseText += `${index + 1}. **${product.name}**\n`;
              responseText += `   Code: ${product.code}\n`;
              responseText += `   Price: ${product.price || "N/A"}\n`;
              responseText += `   ${scoreInfo}\n\n`;
            });

            if (result.totalHistoryMatches && result.totalHistoryMatches > 0) {
              responseText += `📊 Found ${result.totalHistoryMatches} products in your purchase history matching "${searchTerm}"\n`;
              responseText += `🎯 Top match: **${matches[0].product.name}** (most likely choice based on your buying patterns)\n`;
            }
          }

          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to get smart product matches: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      },
    );
  },
  // Server capabilities
  {
    capabilities: {
      tools: {},
    },
  },
  // Configuration
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: true,
  },
);

export { handler as GET, handler as POST };
