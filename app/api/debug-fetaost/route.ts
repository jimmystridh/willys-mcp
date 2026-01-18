import { type NextRequest, NextResponse } from "next/server";

interface ProductWithPurchaseCount {
  name: string;
  product_code: string;
  purchase_count: number;
  category_name: string | null;
}

interface CountResult {
  count: number;
}

interface WillysDatabaseWithDb {
  ensureInitialized(): Promise<void>;
  db: {
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
    };
  };
}

export async function POST(_request: NextRequest) {
  try {
    const { willysDatabase } = await import("../../../lib/database");
    await willysDatabase.ensureInitialized();

    const db = (willysDatabase as unknown as WillysDatabaseWithDb).db;

    // Check if Fetaost products exist in order_products (i.e., have been purchased)
    const fetaostInOrders = db
      .prepare(`
      SELECT p.name, p.product_code, COUNT(*) as purchase_count, c.name as category_name
      FROM products p
      LEFT JOIN order_products op ON p.product_code = op.product_code
      LEFT JOIN categories c ON op.category_id = c.category_id
      WHERE p.product_code IN ('101268415_ST', '101533198_ST')
      GROUP BY p.product_code, c.name
    `)
      .all() as ProductWithPurchaseCount[];

    // Check total products vs products with purchases
    const totalProducts = db
      .prepare("SELECT COUNT(*) as count FROM products")
      .get() as CountResult;
    const productsWithPurchases = db
      .prepare(`
      SELECT COUNT(DISTINCT p.product_code) as count
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
    `)
      .get() as CountResult;

    // Check if there are any cheese products with purchases
    const cheeseWithPurchases = db
      .prepare(`
      SELECT p.name, p.product_code, COUNT(*) as purchase_count, c.name as category_name
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
      JOIN categories c ON op.category_id = c.category_id
      WHERE c.name = 'Mejeri, ost & ägg' AND p.name LIKE '%ost%'
      GROUP BY p.product_code
      LIMIT 10
    `)
      .all() as ProductWithPurchaseCount[];

    return NextResponse.json({
      success: true,
      debug: {
        fetaostInOrders,
        totalProducts: totalProducts.count,
        productsWithPurchases: productsWithPurchases.count,
        purchaseRatio: `${productsWithPurchases.count}/${totalProducts.count} (${((productsWithPurchases.count / totalProducts.count) * 100).toFixed(1)}%)`,
        cheeseWithPurchases,
      },
    });
  } catch (error) {
    console.error("Debug fetaost error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
