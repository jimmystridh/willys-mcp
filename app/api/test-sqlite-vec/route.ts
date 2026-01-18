import { type NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  try {
    console.log("Testing sqlite-vec initialization...");

    // Import the database instance
    const { willysDatabase } = await import("../../../lib/database");

    // Initialize the database - this will trigger sqlite-vec loading
    await willysDatabase.ensureInitialized();

    console.log("Database initialization successful");

    return NextResponse.json({
      success: true,
      message: "sqlite-vec loaded successfully in Next.js environment",
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        name: error instanceof Error ? error.name : undefined,
        code: (error as NodeJS.ErrnoException)?.code,
      },
      { status: 500 },
    );
  }
}
