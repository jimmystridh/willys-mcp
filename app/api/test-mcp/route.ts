import { type NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: "MCP test endpoint is working",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({
    message: "MCP test endpoint received POST",
    body,
    timestamp: new Date().toISOString(),
  });
}
