"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthResult, WillysCredentials } from "@/lib/types";

export async function authenticateWithWillys(
  credentials: WillysCredentials,
): Promise<AuthResult> {
  try {
    console.log("Starting Puppeteer authentication...");

    // Use dynamic import for Puppeteer to avoid issues
    const { loginWithPuppeteer } = await import("@/lib/puppeteer-auth");

    const sessionCookies = await loginWithPuppeteer(
      credentials.username,
      credentials.password,
    );

    console.log("Puppeteer login successful, storing cookies...");

    const cookieStore = await cookies();

    // Store all the session cookies as a single JSON string
    // This way we can retrieve and use them for external API calls
    const cookieJson = JSON.stringify(sessionCookies);

    cookieStore.set("willys-session-cookies", cookieJson, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Set our authentication flag
    cookieStore.set("willys-authenticated", "true", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    console.log("Authentication completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Puppeteer authentication error:", error);

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

export async function logout() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  for (const cookie of allCookies) {
    cookieStore.delete(cookie.name);
  }

  redirect("/login");
}

export async function getWillysCookies(): Promise<string> {
  const cookieStore = await cookies();
  const sessionCookiesJson = cookieStore.get("willys-session-cookies")?.value;

  if (!sessionCookiesJson) {
    console.log("No Willys session cookies found");
    return "";
  }

  try {
    const sessionCookies = JSON.parse(sessionCookiesJson);
    console.log("Found Willys cookies:", Object.keys(sessionCookies));

    const cookieString = Object.entries(sessionCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

    console.log("Cookie string length:", cookieString.length);
    console.log(
      "Cookie string preview:",
      `${cookieString.substring(0, 100)}...`,
    );

    return cookieString;
  } catch (error) {
    console.error("Error parsing session cookies JSON:", error);
    return "";
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("willys-authenticated")?.value === "true";
}
