import { type NextRequest, NextResponse } from "next/server";

interface CategoryRow {
  category_id: number;
  name: string;
  name_normalized: string;
}

interface ProductCategoryRow {
  name: string;
  product_code: string;
  category_name: string;
  category_id: number;
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

    // Get all categories
    const categories = db
      .prepare("SELECT * FROM categories ORDER BY name")
      .all() as CategoryRow[];

    // Search for cheese-related categories
    const cheeseCategories = categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes("ost") ||
        cat.name.toLowerCase().includes("mejeri") ||
        cat.name.toLowerCase().includes("dairy") ||
        cat.name.toLowerCase().includes("cheese"),
    );

    // Check some specific products to see their categories
    const cheeseProducts = db
      .prepare(`
      SELECT p.name, p.product_code, c.name as category_name, c.category_id
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
      JOIN categories c ON op.category_id = c.category_id
      WHERE p.name LIKE '%ost%' OR p.name LIKE '%gouda%' OR p.name LIKE '%cheddar%'
      GROUP BY p.product_code, c.category_id
      LIMIT 15
    `)
      .all() as ProductCategoryRow[];

    // Check what categories "Fetaost" and similar products belong to
    const fetaostProducts = db
      .prepare(`
      SELECT p.name, p.product_code, c.name as category_name, c.category_id
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
      JOIN categories c ON op.category_id = c.category_id
      WHERE p.product_code IN ('101268415_ST', '101533198_ST')
      GROUP BY p.product_code, c.category_id
    `)
      .all() as ProductCategoryRow[];

    return NextResponse.json({
      success: true,
      data: {
        totalCategories: categories.length,
        allCategories: categories.slice(0, 20), // First 20 for brevity
        cheeseRelatedCategories: cheeseCategories,
        cheeseProducts,
        fetaostCategories: fetaostProducts,
      },
    });
  } catch (error) {
    console.error("Debug categories error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
