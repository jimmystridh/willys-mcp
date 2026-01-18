"use server";

import type { AuthResult, WillysCredentials } from "@/lib/types";
import { mcpSessionStore } from "./mcp-session-store";

/**
 * MCP-specific authentication functions that use session store instead of HTTP cookies
 */

export async function mcpAuthenticateWithWillys(
  sessionId: string,
  credentials: WillysCredentials,
): Promise<AuthResult & { sessionId?: string }> {
  try {
    console.log("Starting MCP Puppeteer authentication...");

    // Use dynamic import for Puppeteer to avoid issues
    const { loginWithPuppeteer } = await import("@/lib/puppeteer-auth");

    const sessionCookies = await loginWithPuppeteer(
      credentials.username,
      credentials.password,
    );

    console.log("Puppeteer login successful, storing in MCP session...");

    // Convert cookies object to string format
    const cookieString = Object.entries(sessionCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

    // Store in MCP session store
    mcpSessionStore.storeSession(sessionId, cookieString);

    console.log("MCP authentication completed successfully");
    return { success: true, sessionId };
  } catch (error) {
    console.error("MCP Puppeteer authentication error:", error);

    let errorMessage = "Authentication failed";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function mcpLogout(sessionId: string): Promise<void> {
  mcpSessionStore.clearSession(sessionId);
}

export async function mcpGetWillysCookies(sessionId: string): Promise<string> {
  const session = mcpSessionStore.getSession(sessionId);
  if (!session) {
    console.log("No MCP session found for ID:", sessionId);
    return "";
  }

  console.log("Found MCP session cookies for ID:", sessionId);
  console.log("Cookie string length:", session.cookies.length);
  console.log(
    "Cookie string preview:",
    `${session.cookies.substring(0, 100)}...`,
  );

  return session.cookies;
}

export async function mcpIsAuthenticated(sessionId: string): Promise<boolean> {
  const session = mcpSessionStore.getSession(sessionId);
  return session?.authenticated === true;
}
