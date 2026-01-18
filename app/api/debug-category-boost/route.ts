import { type NextRequest, NextResponse } from "next/server";

interface ProductRow {
  product_code: string;
  name: string;
  manufacturer: string | null;
}

interface VectorSearchResult {
  productCode: string;
  name: string;
  manufacturer: string | null;
  similarity: number;
}

interface WillysDatabaseWithDb {
  ensureInitialized(): Promise<void>;
  vectorSearchProducts(
    query: string,
    maxResults: number,
  ): Promise<VectorSearchResult[]>;
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

    const db = willysDatabase as unknown as WillysDatabaseWithDb;

    // Get vector results for "ost"
    const vectorCandidates = await db.vectorSearchProducts("ost", 10);

    // Get products in "Mejeri, ost & ägg" category
    const categoryProducts = db.db
      .prepare(`
      SELECT DISTINCT p.product_code, p.name, p.manufacturer
      FROM products p
      JOIN order_products op ON p.product_code = op.product_code
      JOIN categories c ON op.category_id = c.category_id
      WHERE c.name = ?
      LIMIT ?
    `)
      .all("Mejeri, ost & ägg", 20) as ProductRow[];

    // Check overlap
    const vectorCodes = new Set(vectorCandidates.map((r) => r.productCode));
    const categoryCodes = new Set(categoryProducts.map((r) => r.product_code));

    const overlap = vectorCandidates.filter((r) =>
      categoryCodes.has(r.productCode),
    );
    const categorySet = new Set(categoryProducts.map((r) => r.product_code));

    return NextResponse.json({
      success: true,
      debug: {
        vectorResultCount: vectorCandidates.length,
        categoryProductCount: categoryProducts.length,
        overlapCount: overlap.length,
        vectorResults: vectorCandidates.map((r) => ({
          name: r.name,
          code: r.productCode,
          inCategory: categorySet.has(r.productCode),
        })),
        categoryProducts: categoryProducts.slice(0, 10).map((r) => ({
          name: r.name,
          code: r.product_code,
          inVector: vectorCodes.has(r.product_code),
        })),
        overlap: overlap.map((r) => ({
          name: r.name,
          similarity: r.similarity,
        })),
      },
    });
  } catch (error) {
    console.error("Debug category boost error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
