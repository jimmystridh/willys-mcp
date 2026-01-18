#!/usr/bin/env node

/**
 * Vector search testing and validation
 */

const { willysDatabase } = require("./lib/database");

// Test data for semantic similarity
const testCases = [
  {
    query: "ost",
    expectedSemantic: [
      "gouda",
      "cheddar",
      "brie",
      "feta",
      "parmesan",
      "cheese",
    ],
    description: 'Swedish "cheese" should find various cheese types',
  },
  {
    query: "mjölk",
    expectedSemantic: ["milk", "mjölk", "latte", "cream"],
    description: 'Swedish "milk" should find milk-related products',
  },
  {
    query: "bröd",
    expectedSemantic: ["bread", "bröd", "bagel", "toast", "sourdough"],
    description: 'Swedish "bread" should find bread-related products',
  },
  {
    query: "kött",
    expectedSemantic: ["meat", "beef", "chicken", "pork", "lamb"],
    description: 'Swedish "meat" should find meat products',
  },
  {
    query: "äpplen",
    expectedSemantic: ["apple", "äpple", "fruit"],
    description: 'Swedish "apples" should find apple products',
  },
];

async function testVectorSearch() {
  console.log("🔍 Testing Vector Search Implementation\n");

  // Get database stats
  const stats = willysDatabase.getStats();
  console.log("Database Statistics:");
  console.log(`- Products: ${stats.products}`);
  console.log(`- Embedded products: ${stats.embeddedProducts}`);
  console.log(`- Vector records: ${stats.vectorRecords}`);
  console.log("");

  if (stats.embeddedProducts === 0) {
    console.log(
      "⚠️  No embedded products found. Checking if embeddings need to be generated...",
    );

    if (willysDatabase.needsEmbeddingMigration()) {
      console.log(
        "🚀 Starting embedding generation (this may take a few minutes)...",
      );

      // Set up environment variable check
      if (!process.env.OPENAI_API_KEY) {
        console.error(
          "❌ OPENAI_API_KEY environment variable is required for embedding generation",
        );
        console.log("Please set your OpenAI API key:");
        console.log('export OPENAI_API_KEY="your-api-key-here"');
        return;
      }

      try {
        const result = await willysDatabase.generateMissingEmbeddings(25); // Smaller batches for testing
        console.log(
          `✅ Embedding generation completed: ${result.processed} processed, ${result.errors} errors`,
        );

        const updatedStats = willysDatabase.getStats();
        console.log(
          `Updated stats: ${updatedStats.embeddedProducts} embedded products\n`,
        );
      } catch (error) {
        console.error("❌ Error generating embeddings:", error.message);
        console.log("Continuing with text-only tests...\n");
      }
    }
  }

  // Test 1: Basic vector search
  console.log("Test 1: Basic Vector Search");
  console.log("=".repeat(50));

  for (const testCase of testCases.slice(0, 3)) {
    // Test first 3 cases
    console.log(`\nTesting: "${testCase.query}" - ${testCase.description}`);

    try {
      const vectorResults = await willysDatabase.vectorSearchProducts(
        testCase.query,
        5,
      );
      console.log(`  Vector results (${vectorResults.length}):`);

      vectorResults.forEach((result, i) => {
        console.log(`    ${i + 1}. ${result.name} (${result.productCode})`);
        console.log(
          `       Similarity: ${(result.similarity * 100).toFixed(1)}%`,
        );
      });

      if (vectorResults.length === 0) {
        console.log(
          "    No vector results found (embeddings may not be generated yet)",
        );
      }
    } catch (error) {
      console.log(`    Vector search error: ${error.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);

  // Test 2: Hybrid search comparison
  console.log("\nTest 2: Hybrid Search vs Text-only Comparison");
  console.log("=".repeat(50));

  for (const testCase of testCases.slice(0, 2)) {
    // Test first 2 cases
    console.log(`\nComparing results for: "${testCase.query}"`);

    // Text-only search
    const textResults = willysDatabase.smartSearchProducts(testCase.query, 3);
    console.log(`  Text-only results (${textResults.length}):`);
    textResults.forEach((result, i) => {
      console.log(
        `    ${i + 1}. ${result.name} (score: ${result.score}, freq: ${result.frequency})`,
      );
    });

    // Hybrid search
    try {
      const hybridResults = await willysDatabase.hybridSearchProducts(
        testCase.query,
        3,
      );
      console.log(`  Hybrid results (${hybridResults.length}):`);
      hybridResults.forEach((result, i) => {
        console.log(
          `    ${i + 1}. ${result.name} (score: ${result.score.toFixed(1)}, freq: ${result.frequency}, sim: ${(result.similarity * 100).toFixed(1)}%, source: ${result.source})`,
        );
      });
    } catch (error) {
      console.log(`    Hybrid search error: ${error.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);

  // Test 3: Performance benchmarking
  console.log("\nTest 3: Performance Benchmarking");
  console.log("=".repeat(50));

  const performanceTests = ["ost", "mjölk", "bröd"];
  const iterations = 5;

  for (const query of performanceTests) {
    console.log(`\nBenchmarking "${query}" (${iterations} iterations):`);

    // Text search benchmark
    const textTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      willysDatabase.smartSearchProducts(query, 5);
      const end = performance.now();
      textTimes.push(end - start);
    }
    const avgTextTime = textTimes.reduce((a, b) => a + b, 0) / textTimes.length;

    // Vector search benchmark (if available)
    let avgVectorTime = "N/A";
    if (stats.embeddedProducts > 0) {
      try {
        const vectorTimes = [];
        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          await willysDatabase.vectorSearchProducts(query, 5);
          const end = performance.now();
          vectorTimes.push(end - start);
        }
        avgVectorTime = `${(vectorTimes.reduce((a, b) => a + b, 0) / vectorTimes.length).toFixed(3)}ms`;
      } catch (error) {
        avgVectorTime = `Error: ${error.message}`;
      }
    }

    // Hybrid search benchmark (if available)
    let avgHybridTime = "N/A";
    if (stats.embeddedProducts > 0) {
      try {
        const hybridTimes = [];
        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          await willysDatabase.hybridSearchProducts(query, 5);
          const end = performance.now();
          hybridTimes.push(end - start);
        }
        avgHybridTime = `${(hybridTimes.reduce((a, b) => a + b, 0) / hybridTimes.length).toFixed(3)}ms`;
      } catch (error) {
        avgHybridTime = `Error: ${error.message}`;
      }
    }

    console.log(`  Text search:   ${avgTextTime.toFixed(3)}ms`);
    console.log(`  Vector search: ${avgVectorTime}`);
    console.log(`  Hybrid search: ${avgHybridTime}`);
  }

  console.log(`\n${"=".repeat(50)}`);

  // Test 4: Edge cases
  console.log("\nTest 4: Edge Cases");
  console.log("=".repeat(50));

  const edgeCases = [
    { query: "", description: "Empty query" },
    { query: "xyz123nonexistent", description: "Non-existent product" },
    { query: "å ä ö", description: "Special Swedish characters" },
    { query: "a".repeat(100), description: "Very long query" },
  ];

  for (const testCase of edgeCases) {
    console.log(`\nTesting: "${testCase.query}" - ${testCase.description}`);

    try {
      const hybridResults = await willysDatabase.hybridSearchProducts(
        testCase.query,
        3,
      );
      console.log(`  Results: ${hybridResults.length} matches`);
      hybridResults.slice(0, 2).forEach((result, i) => {
        console.log(
          `    ${i + 1}. ${result.name} (score: ${result.score.toFixed(1)})`,
        );
      });
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("\n✅ Vector search testing completed!");

  // Final recommendations
  if (stats.embeddedProducts === 0) {
    console.log("\n📋 Recommendations:");
    console.log("1. Set OPENAI_API_KEY environment variable");
    console.log("2. Run embedding generation to enable vector search");
    console.log(
      "3. Vector search will provide semantic similarity for better matches",
    );
  } else {
    console.log(
      `\n📊 System Status: Ready with ${stats.embeddedProducts} embedded products!`,
    );
    console.log(
      "Vector search is active and providing semantic similarity matching.",
    );
  }
}

// Run tests
testVectorSearch().catch(console.error);
