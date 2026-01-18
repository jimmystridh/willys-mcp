#!/usr/bin/env npx tsx
/**
 * Willys MCP Server - Stdio Transport
 *
 * A standalone MCP server that communicates via stdio for use with Claude Code.
 * Provides access to Willys grocery operations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { willysDatabase } from "./lib/database";
import {
  mcpAuthenticateWithWillys,
  mcpIsAuthenticated,
  mcpLogout,
} from "./lib/mcp-auth";
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
} from "./lib/mcp-orders";
import { mcpSessionStore } from "./lib/mcp-session-store";

const server = new Server(
  {
    name: "willys-checklist",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define all tools
const tools = [
  {
    name: "mcp__willys_login",
    description:
      "Login to Willys with username and password. Returns a sessionId that must be used in subsequent tool calls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Willys username/email" },
        password: { type: "string", description: "Willys password" },
      },
      required: ["username", "password"],
    },
  },
  {
    name: "mcp__willys_logout",
    description: "Logout from Willys and clear authentication session",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID to logout" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_check_auth",
    description: "Check if currently authenticated with Willys",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID to check" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_orders",
    description:
      "Get order history from Willys. Returns list of past orders with details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_order_details",
    description:
      "Get detailed information about a specific order including all items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        orderId: {
          type: "string",
          description: "The order ID to get details for",
        },
      },
      required: ["sessionId", "orderId"],
    },
  },
  {
    name: "mcp__willys_get_cart",
    description: "Get current shopping cart contents",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_add_to_cart",
    description: "Add a product to the shopping cart",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        productCode: {
          type: "string",
          description: "Product code (e.g., '101175556_ST')",
        },
        quantity: {
          type: "number",
          description: "Quantity to add (default: 1)",
        },
      },
      required: ["sessionId", "productCode"],
    },
  },
  {
    name: "mcp__willys_remove_from_cart",
    description: "Remove a product from the shopping cart",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        productCode: { type: "string", description: "Product code to remove" },
      },
      required: ["sessionId", "productCode"],
    },
  },
  {
    name: "mcp__willys_checkout",
    description: "Initiate checkout process for the current cart",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_customer_info",
    description: "Get customer profile and bonus information",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_delivery_slots",
    description: "Get available delivery time slots for a postal code",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        postalCode: {
          type: "string",
          description: "Postal code for delivery (default: '12345')",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_pickup_slots",
    description: "Get available pickup time slots for a store",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        storeId: {
          type: "string",
          description: "Store ID for pickup (default: '2288')",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_select_slot",
    description: "Select a delivery or pickup time slot",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        slotCode: { type: "string", description: "The slot code to select" },
        isTmsSlot: {
          type: "boolean",
          description: "Whether this is a TMS slot (default: false)",
        },
      },
      required: ["sessionId", "slotCode"],
    },
  },
  {
    name: "mcp__willys_search",
    description: "Search for products in the Willys catalog",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        query: { type: "string", description: "Search query" },
        page: { type: "number", description: "Page number (default: 0)" },
        size: { type: "number", description: "Results per page (default: 30)" },
      },
      required: ["sessionId", "query"],
    },
  },
  {
    name: "mcp__willys_search_suggestions",
    description: "Get autocomplete suggestions for a search query",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        query: { type: "string", description: "Partial search query" },
      },
      required: ["sessionId", "query"],
    },
  },
  {
    name: "mcp__willys_get_offers",
    description: "Get current promotions and offers",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_common_products",
    description:
      "Get personalized product recommendations based on purchase history",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_product_detail",
    description: "Get detailed information about a specific product",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        productCode: { type: "string", description: "Product code" },
        productName: {
          type: "string",
          description: "Product name (optional, for URL construction)",
        },
      },
      required: ["sessionId", "productCode"],
    },
  },
  {
    name: "mcp__willys_get_smart_product_matches",
    description:
      "AI-powered product matching using purchase history and semantic search",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID for authentication",
        },
        searchTerm: { type: "string", description: "Product to search for" },
        limit: { type: "number", description: "Maximum results (default: 5)" },
      },
      required: ["sessionId", "searchTerm"],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "mcp__willys_login": {
        const { username, password } = args as {
          username: string;
          password: string;
        };
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
                text: `✅ Successfully logged in. Session ID: ${sessionId}\n\nUse this sessionId in all subsequent tool calls.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `❌ Login failed: ${result.error || "Invalid credentials"}`,
            },
          ],
        };
      }

      case "mcp__willys_logout": {
        const { sessionId } = args as { sessionId: string };
        await mcpLogout(sessionId);
        return {
          content: [{ type: "text", text: "✅ Successfully logged out" }],
        };
      }

      case "mcp__willys_check_auth": {
        const { sessionId } = args as { sessionId: string };
        const isAuth = await mcpIsAuthenticated(sessionId);
        return {
          content: [
            {
              type: "text",
              text: isAuth ? "✅ Authenticated" : "❌ Not authenticated",
            },
          ],
        };
      }

      case "mcp__willys_get_orders": {
        const { sessionId } = args as { sessionId: string };
        const orders = await mcpGetOrders(sessionId);
        return {
          content: [
            {
              type: "text",
              text: `✅ Found ${orders.length} orders:\n${JSON.stringify(orders, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_order_details": {
        const { sessionId, orderId } = args as {
          sessionId: string;
          orderId: string;
        };
        const order = await mcpGetOrderDetails(sessionId, orderId);
        if (!order) {
          return { content: [{ type: "text", text: `❌ Order not found` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Order details:\n${JSON.stringify(order, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_cart": {
        const { sessionId } = args as { sessionId: string };
        const cart = await mcpGetCart(sessionId);
        if (!cart) {
          return {
            content: [{ type: "text", text: `❌ Failed to fetch cart` }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Cart (${cart.totalItems} items, ${cart.totalPrice}):\n${JSON.stringify(cart, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_add_to_cart": {
        const {
          sessionId,
          productCode,
          quantity = 1,
        } = args as {
          sessionId: string;
          productCode: string;
          quantity?: number;
        };
        const result = await mcpAddToCart(sessionId, productCode, quantity);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `✅ Added to cart`
                : `❌ ${result.message}`,
            },
          ],
        };
      }

      case "mcp__willys_remove_from_cart": {
        const { sessionId, productCode } = args as {
          sessionId: string;
          productCode: string;
        };
        const result = await mcpRemoveFromCart(sessionId, productCode);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `✅ Removed from cart`
                : `❌ ${result.message}`,
            },
          ],
        };
      }

      case "mcp__willys_checkout": {
        const { sessionId } = args as { sessionId: string };
        const result = await mcpCheckout(sessionId);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `✅ Checkout initiated`
                : `❌ ${result.message}`,
            },
          ],
        };
      }

      case "mcp__willys_get_customer_info": {
        const { sessionId } = args as { sessionId: string };
        const customer = await mcpGetCustomerInfo(sessionId);
        if (!customer) {
          return {
            content: [{ type: "text", text: `❌ Failed to get customer info` }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Customer info:\n${JSON.stringify(customer, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_delivery_slots": {
        const { sessionId, postalCode = "12345" } = args as {
          sessionId: string;
          postalCode?: string;
        };
        const slots = await mcpGetDeliverySlots(sessionId, postalCode);
        if (!slots) {
          return {
            content: [
              { type: "text", text: `❌ Failed to get delivery slots` },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Delivery slots:\n${JSON.stringify(slots, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_pickup_slots": {
        const { sessionId, storeId = "2288" } = args as {
          sessionId: string;
          storeId?: string;
        };
        const slots = await mcpGetPickupSlots(sessionId, storeId);
        if (!slots) {
          return {
            content: [{ type: "text", text: `❌ Failed to get pickup slots` }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Pickup slots:\n${JSON.stringify(slots, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_select_slot": {
        const {
          sessionId,
          slotCode,
          isTmsSlot = false,
        } = args as {
          sessionId: string;
          slotCode: string;
          isTmsSlot?: boolean;
        };
        const result = await mcpSelectSlot(sessionId, slotCode, isTmsSlot);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `✅ Slot selected`
                : `❌ ${result.message}`,
            },
          ],
        };
      }

      case "mcp__willys_search": {
        const {
          sessionId,
          query,
          page = 0,
          size = 30,
        } = args as {
          sessionId: string;
          query: string;
          page?: number;
          size?: number;
        };
        const result = await mcpSearchProducts(sessionId, query, page, size);
        if (!result.success) {
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Search results for "${query}":\n${JSON.stringify(result.products, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_search_suggestions": {
        const { sessionId, query } = args as {
          sessionId: string;
          query: string;
        };
        const result = await mcpGetSearchSuggestions(sessionId, query);
        if (!result.success) {
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Suggestions:\n${JSON.stringify(result.suggestions, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_offers": {
        const { sessionId } = args as { sessionId: string };
        const result = await mcpGetOffers(sessionId);
        if (!result.success) {
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Offers:\n${JSON.stringify(result.offers, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_common_products": {
        const { sessionId } = args as { sessionId: string };
        const result = await mcpGetCommonProducts(sessionId);
        if (!result.success) {
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Common products:\n${JSON.stringify(result.commonProducts, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_product_detail": {
        const { sessionId, productCode, productName } = args as {
          sessionId: string;
          productCode: string;
          productName?: string;
        };
        const result = await mcpGetProductDetail(
          sessionId,
          productCode,
          productName,
        );
        if (!result.success) {
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `✅ Product detail:\n${JSON.stringify(result.productDetail, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_smart_product_matches": {
        const {
          sessionId,
          searchTerm,
          limit = 5,
        } = args as { sessionId: string; searchTerm: string; limit?: number };
        const result = await mcpGetSmartProductMatches(
          sessionId,
          searchTerm,
          limit,
        );
        if (!result.success) {
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        }
        const matches = result.matches || [];
        let text = `✅ Smart matches for "${searchTerm}":\n\n`;
        matches.forEach(
          (
            match: {
              product: { name: string; code: string; price?: string };
              score: number;
              frequency: number;
            },
            i: number,
          ) => {
            text += `${i + 1}. ${match.product.name} (${match.product.code}) - Score: ${match.score}, Freq: ${match.frequency}\n`;
          },
        );
        return { content: [{ type: "text", text }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  // Initialize database before starting server
  await willysDatabase.ensureInitialized();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Willys MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
