/**
 * SQLite-based session store for MCP authentication
 * Provides persistent, reliable session management with order cache integration
 */

import { randomUUID } from "node:crypto";
import { willysDatabase } from "./database";
import { orderCache } from "./mcp-order-cache";

interface Session {
  cookies: string;
  authenticated: boolean;
  timestamp?: number; // Keep for backward compatibility
}

class McpSessionStore {
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  generateSessionId(): string {
    return randomUUID();
  }

  storeSession(sessionId: string, cookies: string): void {
    try {
      willysDatabase.storeSession(sessionId, cookies, this.SESSION_TIMEOUT);
      console.log(`Session ${sessionId} stored in database`);
    } catch (error) {
      console.error(`Error storing session ${sessionId}:`, error);
      throw error;
    }
  }

  getSession(sessionId: string): Session | null {
    try {
      const session = willysDatabase.getSession(sessionId);
      if (!session) return null;

      return {
        cookies: session.cookies,
        authenticated: session.authenticated,
        timestamp: Date.now(), // For backward compatibility
      };
    } catch (error) {
      console.error(`Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  clearSession(sessionId: string): void {
    try {
      // Clear associated order cache first
      orderCache.clearBySession(sessionId);

      // Clear the session (this will also cascade delete order cache entries)
      willysDatabase.clearSession(sessionId);

      console.log(`Session ${sessionId} cleared from database`);
    } catch (error) {
      console.error(`Error clearing session ${sessionId}:`, error);
    }
  }

  cleanup(): void {
    try {
      willysDatabase.cleanup();
    } catch (error) {
      console.error("Error during session cleanup:", error);
    }
  }

  /**
   * Get session store statistics
   */
  async getStats(): Promise<{ sessions: number; cachedOrders: number }> {
    try {
      const stats = await willysDatabase.getStats();
      return { sessions: stats.sessions, cachedOrders: stats.cachedOrders };
    } catch (error) {
      console.error("Error getting session store stats:", error);
      return { sessions: 0, cachedOrders: 0 };
    }
  }

  /**
   * Check if a session exists and is valid
   */
  isValidSession(sessionId: string): boolean {
    return this.getSession(sessionId) !== null;
  }
}

// Global session store instance
export const mcpSessionStore = new McpSessionStore();

// Note: Cleanup is now handled by the database class, no need for setInterval here
