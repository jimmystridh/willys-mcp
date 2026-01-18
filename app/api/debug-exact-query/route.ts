import { type NextRequest, NextResponse } from "next/server";

interface ProductRow {
  product_code: string;
  name: string;
  manufacturer: string | null;
}

interface WillysDatabaseWithDb {
  ensureInitialized(): Promise<void>;
  db: {
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
    };
  };
}

export async function POST(_request: NextRequest) {
  try {
    const { willysDatabase } = await import("../../../lib/database");
    await willysDatabase.ensureInitialized();

    const db = (willysDatabase as unknown as WillysDatabaseWithDb).db;

    // Run the exact same query as in the category-aware search
    const categoryProducts = db
      .prepare(`
      SELECT DISTINCT p.product_code, p.name, p.manufacturer
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
      JOIN categories c ON op.category_id = c.category_id
      WHERE c.name = ?
      LIMIT ?
    `)
      .all("Mejeri, ost & ägg", 30) as ProductRow[];

    // Check specifically for Fetaost
    const fetaostResults = categoryProducts.filter(
      (p) =>
        p.product_code === "101268415_ST" || p.product_code === "101533198_ST",
    );

    return NextResponse.json({
      success: true,
      debug: {
        totalCategoryProducts: categoryProducts.length,
        fetaostFound: fetaostResults,
        allProducts: categoryProducts.map((p) => ({
          name: p.name,
          code: p.product_code,
        })),
      },
    });
  } catch (error) {
    console.error("Debug exact query error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
