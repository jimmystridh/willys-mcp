/**
 * SSE-based MCP endpoint (no Redis required)
 *
 * Simple SSE implementation for Next.js App Router.
 * GET: Establish SSE connection
 * POST: Send MCP requests
 */

import { willysDatabase } from "@/lib/database";
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

// Active SSE connections
const connections = new Map<string, ReadableStreamDefaultController>();

// Tool definitions
const tools = [
  {
    name: "mcp__willys_login",
    description: "Login to Willys",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "password"],
    },
  },
  {
    name: "mcp__willys_logout",
    description: "Logout",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_check_auth",
    description: "Check auth status",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_orders",
    description: "Get orders",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_order_details",
    description: "Get order details",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        orderId: { type: "string" },
      },
      required: ["sessionId", "orderId"],
    },
  },
  {
    name: "mcp__willys_get_cart",
    description: "Get cart",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_add_to_cart",
    description: "Add to cart",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        productCode: { type: "string" },
        quantity: { type: "number" },
      },
      required: ["sessionId", "productCode"],
    },
  },
  {
    name: "mcp__willys_remove_from_cart",
    description: "Remove from cart",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        productCode: { type: "string" },
      },
      required: ["sessionId", "productCode"],
    },
  },
  {
    name: "mcp__willys_checkout",
    description: "Checkout",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_customer_info",
    description: "Get customer info",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_delivery_slots",
    description: "Get delivery slots",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        postalCode: { type: "string" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_pickup_slots",
    description: "Get pickup slots",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        storeId: { type: "string" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_select_slot",
    description: "Select slot",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        slotCode: { type: "string" },
        isTmsSlot: { type: "boolean" },
      },
      required: ["sessionId", "slotCode"],
    },
  },
  {
    name: "mcp__willys_search",
    description: "Search products",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        query: { type: "string" },
        page: { type: "number" },
        size: { type: "number" },
      },
      required: ["sessionId", "query"],
    },
  },
  {
    name: "mcp__willys_search_suggestions",
    description: "Search suggestions",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" }, query: { type: "string" } },
      required: ["sessionId", "query"],
    },
  },
  {
    name: "mcp__willys_get_offers",
    description: "Get offers",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_common_products",
    description: "Get common products",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "mcp__willys_get_product_detail",
    description: "Get product detail",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        productCode: { type: "string" },
        productName: { type: "string" },
      },
      required: ["sessionId", "productCode"],
    },
  },
  {
    name: "mcp__willys_get_smart_product_matches",
    description: "Smart product matching",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        searchTerm: { type: "string" },
        limit: { type: "number" },
      },
      required: ["sessionId", "searchTerm"],
    },
  },
];

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
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
              { type: "text", text: `✅ Logged in. Session: ${sessionId}` },
            ],
          };
        }
        return {
          content: [{ type: "text", text: `❌ Login failed: ${result.error}` }],
        };
      }

      case "mcp__willys_logout": {
        const { sessionId } = args as { sessionId: string };
        await mcpLogout(sessionId);
        return { content: [{ type: "text", text: "✅ Logged out" }] };
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
              text: `✅ ${orders.length} orders:\n${JSON.stringify(orders, null, 2)}`,
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
        if (!order)
          return { content: [{ type: "text", text: "❌ Order not found" }] };
        return {
          content: [
            {
              type: "text",
              text: `✅ Order:\n${JSON.stringify(order, null, 2)}`,
            },
          ],
        };
      }

      case "mcp__willys_get_cart": {
        const { sessionId } = args as { sessionId: string };
        const cart = await mcpGetCart(sessionId);
        if (!cart)
          return { content: [{ type: "text", text: "❌ Failed to get cart" }] };
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
                ? "✅ Added to cart"
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
                ? "✅ Removed from cart"
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
                ? "✅ Checkout initiated"
                : `❌ ${result.message}`,
            },
          ],
        };
      }

      case "mcp__willys_get_customer_info": {
        const { sessionId } = args as { sessionId: string };
        const customer = await mcpGetCustomerInfo(sessionId);
        if (!customer)
          return {
            content: [{ type: "text", text: "❌ Failed to get customer info" }],
          };
        return {
          content: [
            {
              type: "text",
              text: `✅ Customer:\n${JSON.stringify(customer, null, 2)}`,
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
        if (!slots)
          return {
            content: [{ type: "text", text: "❌ Failed to get slots" }],
          };
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
        if (!slots)
          return {
            content: [{ type: "text", text: "❌ Failed to get slots" }],
          };
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
                ? "✅ Slot selected"
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
        if (!result.success)
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        return {
          content: [
            {
              type: "text",
              text: `✅ Search "${query}":\n${JSON.stringify(result.products, null, 2)}`,
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
        if (!result.success)
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
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
        if (!result.success)
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
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
        if (!result.success)
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
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
        if (!result.success)
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        return {
          content: [
            {
              type: "text",
              text: `✅ Product:\n${JSON.stringify(result.productDetail, null, 2)}`,
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
        if (!result.success)
          return { content: [{ type: "text", text: `❌ ${result.message}` }] };
        return {
          content: [
            {
              type: "text",
              text: `✅ Smart matches:\n${JSON.stringify(result.matches, null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `❌ Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

// GET: Establish SSE connection
export async function GET(request: Request) {
  await willysDatabase.ensureInitialized();

  const url = new URL(request.url);
  const connectionId =
    url.searchParams.get("connectionId") || crypto.randomUUID();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      connections.set(connectionId, controller);

      // Send connection established
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            method: "connection/established",
            params: { connectionId },
          })}\n\n`,
        ),
      );

      // Keep alive every 30s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        connections.delete(connectionId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Connection-Id": connectionId,
    },
  });
}

// POST: Handle MCP requests
export async function POST(request: Request) {
  await willysDatabase.ensureInitialized();

  const url = new URL(request.url);
  const connectionId = url.searchParams.get("connectionId");

  const body = await request.json();
  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== "2.0") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request" },
    });
  }

  let result: unknown;

  switch (method) {
    case "initialize":
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "willys-mcp", version: "1.0.0" },
      };
      break;

    case "tools/list":
      result = { tools };
      break;

    case "tools/call":
      result = await handleToolCall(params.name, params.arguments || {});
      break;

    default:
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }

  const response = { jsonrpc: "2.0", id, result };

  // If there's an active SSE connection, send via SSE too
  if (connectionId) {
    const controller = connections.get(connectionId);
    if (controller) {
      try {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(response)}\n\n`),
        );
      } catch {
        connections.delete(connectionId);
      }
    }
  }

  return Response.json(response);
}
