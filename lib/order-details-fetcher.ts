/**
 * Shared order details fetcher with caching support
 * Can be used by both MCP and web server actions
 */

import { orderCache } from "./mcp-order-cache";

export interface OrderDetailsResult {
  orderNumber: string;
  categoryOrderedDeliveredProducts?: Record<string, any[]>;
  deliveryFormattedDate?: string;
  statusDisplay?: string;
  totalPrice?: { value: number };
  code?: string;
}

export interface FetchOrderDetailsOptions {
  cookies: string;
  sessionId?: string; // Optional for caching
  useCache?: boolean; // Default: true
}

/**
 * Fetch order details with caching support
 * @param orderNumber - The order number to fetch
 * @param options - Fetch options including cookies and caching preferences
 * @returns Order details or null if failed
 */
export async function fetchOrderDetails(
  orderNumber: string,
  options: FetchOrderDetailsOptions,
): Promise<OrderDetailsResult | null> {
  const { cookies, sessionId, useCache = true } = options;

  try {
    // Check cache first if enabled and sessionId provided
    if (useCache && sessionId) {
      const cachedOrder = orderCache.getCachedOrder(orderNumber);
      if (cachedOrder) {
        console.log(`Cache hit for order ${orderNumber}`);
        return cachedOrder;
      }
      console.log(`Cache miss for order ${orderNumber}, fetching from API`);
    }

    // Fetch from API
    const response = await fetch(
      `https://www.willys.se/axfood/rest/orderdata?q=${orderNumber}`,
      {
        headers: {
          accept: "*/*",
          "accept-language": "en,en-US;q=0.9,sv;q=0.8,en-GB;q=0.7",
          "cache-control": "no-cache",
          "content-type": "application/json",
          cookie: cookies,
          pragma: "no-cache",
          priority: "u=1, i",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch order details: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result if caching is enabled and sessionId provided
    if (useCache && sessionId) {
      orderCache.setCachedOrder(orderNumber, sessionId, data);
      console.log(`Cached raw order data for ${orderNumber}`);

      // Also store in relational format for fast SQL searching
      try {
        const { willysDatabase } = await import("./database");
        willysDatabase.storeOrderRelational(data, sessionId);
        console.log(`Stored order ${orderNumber} in relational format`);
      } catch (error) {
        console.error(
          `Error storing order ${orderNumber} in relational format:`,
          error,
        );
      }
    }

    return data;
  } catch (error) {
    console.error(`Error fetching order details for ${orderNumber}:`, error);
    return null;
  }
}

/**
 * Batch fetch multiple order details with caching
 * @param orderNumbers - Array of order numbers to fetch
 * @param options - Fetch options
 * @returns Map of order number to order details
 */
export async function batchFetchOrderDetails(
  orderNumbers: string[],
  options: FetchOrderDetailsOptions,
): Promise<Map<string, OrderDetailsResult>> {
  const results = new Map<string, OrderDetailsResult>();

  // Process in batches to avoid overwhelming the API
  const batchSize = 3; // Conservative batch size
  const batches = [];

  for (let i = 0; i < orderNumbers.length; i += batchSize) {
    batches.push(orderNumbers.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const promises = batch.map(async (orderNumber) => {
      const details = await fetchOrderDetails(orderNumber, options);
      if (details) {
        results.set(orderNumber, details);
      }
    });

    await Promise.all(promises);

    // Small delay between batches to be respectful to the API
    if (batches.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(
    `Batch fetched ${results.size}/${orderNumbers.length} order details`,
  );
  return results;
}

/**
 * Get cache statistics for order details
 */
export async function getOrderCacheStats(): Promise<{ cachedOrders: number }> {
  return orderCache.getStats();
}
