import { type NextRequest, NextResponse } from "next/server";

interface SearchResult {
  productCode: string;
  name: string;
  manufacturer: string | null;
  frequency?: number;
  similarity?: number;
  score?: number;
  source?: "text" | "vector" | "both";
  categoryBoost?: number;
  finalScore?: number;
  boostedScore?: number;
}

interface SearchMetadata {
  algorithm: string;
  description: string;
  searchType: string;
  detectedCategory?: string;
}

interface ProductRow {
  product_code: string;
  name: string;
  manufacturer: string | null;
}

interface WillysDatabaseWithDb {
  ensureInitialized(): Promise<void>;
  vectorSearchProducts(
    query: string,
    maxResults: number,
  ): Promise<SearchResult[]>;
  smartSearchProducts(
    query: string,
    maxResults: number,
  ): Promise<SearchResult[]>;
  hybridSearchProducts(
    query: string,
    maxResults: number,
  ): Promise<SearchResult[]>;
  vectorSupport?: boolean;
  db: {
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      algorithm = "hybrid",
      maxResults = 10,
    } = (await request.json()) as {
      query: string;
      algorithm?: string;
      maxResults?: number;
    };

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const { willysDatabase } = await import("../../../lib/database");
    await willysDatabase.ensureInitialized();

    const db = willysDatabase as unknown as WillysDatabaseWithDb;

    const startTime = Date.now();
    let results: SearchResult[] = [];
    let metadata: SearchMetadata = {
      algorithm: "",
      description: "",
      searchType: "",
    };

    switch (algorithm) {
      case "vector":
        // Pure vector/semantic search
        results = await db.vectorSearchProducts(query, maxResults);
        metadata = {
          algorithm: "Vector/Semantic Search",
          description: "Pure semantic similarity using OpenAI embeddings",
          searchType: "semantic",
        };
        break;

      case "text":
        // Pure text-based search with frequency/recency scoring
        results = await db.smartSearchProducts(query, maxResults);
        metadata = {
          algorithm: "Smart Text Search",
          description: "Text matching with frequency and recency scoring",
          searchType: "text",
        };
        break;

      case "hybrid":
        // Current hybrid approach
        results = await db.hybridSearchProducts(query, maxResults);
        metadata = {
          algorithm: "Hybrid Search",
          description:
            "Combines text frequency/recency (60%) with semantic similarity (40%)",
          searchType: "hybrid",
        };
        break;

      case "vector-boosted": {
        // Vector search with frequency boosting
        const vectorResults = await db.vectorSearchProducts(
          query,
          maxResults * 2,
        );
        const textResults = await db.smartSearchProducts(query, maxResults * 2);

        // Create frequency lookup
        const frequencyMap = new Map<string, number | undefined>();
        for (const r of textResults) {
          frequencyMap.set(r.productCode, r.frequency);
        }

        // Boost vector results by frequency
        results = vectorResults
          .map((r) => ({
            ...r,
            frequency: frequencyMap.get(r.productCode) || 0,
            boostedScore:
              (r.similarity ?? 0) * 100 +
              (frequencyMap.get(r.productCode) || 0) * 2,
          }))
          .sort((a, b) => b.boostedScore - a.boostedScore)
          .slice(0, maxResults);

        metadata = {
          algorithm: "Vector + Frequency Boost",
          description: "Semantic similarity boosted by purchase frequency",
          searchType: "vector-boosted",
        };
        break;
      }

      case "semantic-first": {
        // High semantic threshold, then text fallback
        const highThresholdVector = await db.vectorSearchProducts(
          query,
          maxResults,
        );
        const highSimilarityResults = highThresholdVector.filter(
          (r) => (r.similarity ?? 0) > 0.4,
        );

        if (highSimilarityResults.length >= 3) {
          results = highSimilarityResults.slice(0, maxResults);
        } else {
          const textFallback = await db.smartSearchProducts(
            query,
            maxResults - highSimilarityResults.length,
          );
          results = [...highSimilarityResults, ...textFallback].slice(
            0,
            maxResults,
          );
        }

        metadata = {
          algorithm: "Semantic First",
          description:
            "High-confidence semantic matches, text fallback if needed",
          searchType: "semantic-first",
        };
        break;
      }

      case "category-aware": {
        // Try to detect category intent and boost accordingly
        const categoryHints = {
          ost: "Mejeri, ost & ägg",
          bröd: "Bröd & Kakor",
          kött: "Kött, chark & fågel",
          fisk: "Fisk & Skaldjur",
          frukt: "Frukt & Grönt",
          grönsak: "Frukt & Grönt",
        };

        const lowerQuery = query.toLowerCase();
        let detectedCategory = null;

        for (const [key, categoryName] of Object.entries(categoryHints)) {
          if (lowerQuery.includes(key)) {
            detectedCategory = categoryName;
            break;
          }
        }

        if (detectedCategory) {
          // Get vector results
          const vectorCandidates = await db.vectorSearchProducts(
            query,
            maxResults * 3,
          );

          // Get products in the detected category using direct SQL
          const categoryProducts = db.db
            .prepare(`
            SELECT DISTINCT p.product_code, p.name, p.manufacturer
            FROM products p
            JOIN order_products op ON p.product_code = op.product_code
            JOIN categories c ON op.category_id = c.category_id
            WHERE c.name = ?
          `)
            .all(detectedCategory) as ProductRow[];

          // Boost products that appear in both vector results and detected category
          const categorySet = new Set(
            categoryProducts.map((r) => r.product_code),
          );
          results = vectorCandidates
            .map((r) => ({
              ...r,
              categoryBoost: categorySet.has(r.productCode) ? 0.3 : 0,
              finalScore:
                (r.similarity ?? 0) +
                (categorySet.has(r.productCode) ? 0.3 : 0),
            }))
            .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
            .slice(0, maxResults);

          metadata = {
            algorithm: "Category-Aware Search",
            description: `Detected category: ${detectedCategory}, boosted ${categoryProducts.length} category products`,
            searchType: "category-aware",
            detectedCategory,
          };
        } else {
          // Fallback to hybrid
          results = await db.hybridSearchProducts(query, maxResults);
          metadata = {
            algorithm: "Category-Aware Search (fallback)",
            description: "No category detected, using hybrid search",
            searchType: "hybrid",
          };
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid algorithm" },
          { status: 400 },
        );
    }

    const searchTime = Date.now() - startTime;

    // Add debugging info
    const debugInfo = {
      query,
      algorithm,
      resultCount: results.length,
      searchTimeMs: searchTime,
      hasVectorSupport: db.vectorSupport || false,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      results,
      metadata,
      debug: debugInfo,
    });
  } catch (error) {
    console.error("Smart search error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
