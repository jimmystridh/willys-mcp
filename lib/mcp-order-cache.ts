/**
 * Order cache module using SQLite for persistent storage
 * Provides caching for Willys order details to improve performance
 */

import { willysDatabase } from "./database";

export class OrderCache {
  /**
   * Get cached order details
   * @param orderNumber - The order number to look up
   * @returns Cached order details or null if not found/expired
   */
  getCachedOrder(orderNumber: string): any | null {
    try {
      return willysDatabase.getCachedOrder(orderNumber);
    } catch (error) {
      console.error(`Error getting cached order ${orderNumber}:`, error);
      return null;
    }
  }

  /**
   * Store order details in cache
   * @param orderNumber - The order number
   * @param sessionId - The session ID that fetched this order
   * @param orderDetails - The order details to cache
   * @param ttlMs - Time to live in milliseconds (default: 24 hours)
   */
  setCachedOrder(
    orderNumber: string,
    sessionId: string,
    orderDetails: any,
    ttlMs?: number,
  ): void {
    try {
      willysDatabase.setCachedOrder(
        orderNumber,
        sessionId,
        orderDetails,
        ttlMs,
      );
    } catch (error) {
      console.error(`Error caching order ${orderNumber}:`, error);
      // Don't throw error - caching failure shouldn't break the main functionality
    }
  }

  /**
   * Clear cached order by order number
   * @param orderNumber - The order number to clear from cache
   */
  clearOrder(orderNumber: string): void {
    try {
      willysDatabase.clearOrderCache(orderNumber);
    } catch (error) {
      console.error(`Error clearing cached order ${orderNumber}:`, error);
    }
  }

  /**
   * Clear all cached orders
   */
  clearAll(): void {
    try {
      willysDatabase.clearOrderCache();
    } catch (error) {
      console.error("Error clearing all cached orders:", error);
    }
  }

  /**
   * Clear cached orders for a specific session
   * @param sessionId - The session ID to clear orders for
   */
  clearBySession(sessionId: string): void {
    try {
      willysDatabase.clearOrderCacheBySession(sessionId);
    } catch (error) {
      console.error(
        `Error clearing cached orders for session ${sessionId}:`,
        error,
      );
    }
  }

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  async getStats(): Promise<{ cachedOrders: number }> {
    try {
      const stats = await willysDatabase.getStats();
      return { cachedOrders: stats.cachedOrders };
    } catch (error) {
      console.error("Error getting cache statistics:", error);
      return { cachedOrders: 0 };
    }
  }

  /**
   * Check if an order is cached (without retrieving the data)
   * @param orderNumber - The order number to check
   * @returns True if the order is cached and not expired
   */
  isCached(orderNumber: string): boolean {
    return this.getCachedOrder(orderNumber) !== null;
  }

  /**
   * Preload multiple orders into cache
   * @param orders - Array of objects with orderNumber, sessionId, and orderDetails
   */
  preloadOrders(
    orders: Array<{
      orderNumber: string;
      sessionId: string;
      orderDetails: any;
    }>,
  ): void {
    try {
      for (const order of orders) {
        this.setCachedOrder(
          order.orderNumber,
          order.sessionId,
          order.orderDetails,
        );
      }
      console.log(`Preloaded ${orders.length} orders into cache`);
    } catch (error) {
      console.error("Error preloading orders:", error);
    }
  }
}

// Global order cache instance
export const orderCache = new OrderCache();
