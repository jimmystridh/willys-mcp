#!/usr/bin/env node

/**
 * Parsing Validation Tests with Presaved Willys HTTP Response Snapshots
 * Tests the search parsing logic without making actual HTTP requests
 */

const fs = require("node:fs");
const path = require("node:path");

// Create snapshots directory if it doesn't exist
const snapshotsDir = path.join(__dirname, "test-snapshots");
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir);
}

class ParsingValidationTests {
  constructor() {
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  // Sample Willys search response snapshot (based on actual "ost" search)
  getSearchSnapshot() {
    return {
      ost: JSON.stringify({
        results: [
          {
            potentialPromotions: [],
            inactivePotentialPromotions: [],
            priceValue: 84.9,
            price: "84,90 kr",
            image: {
              imageType: "PRIMARY",
              format: "product",
              url: "https://assets.axfood.se/image/upload/f_auto,t_200/02359742700005_C1L1_s02",
              altText: null,
              galleryIndex: null,
              width: null,
            },
            ranking: null,
            depositPrice: "",
            averageWeight: 1.2,
            comparePrice: "84,90 kr",
            comparePriceUnit: "kg",
            isDrugProduct: false,
            solrSearchScore: null,
            energyDeclaration: null,
            newsSplashProduct: false,
            notAllowed: false,
            tobaccoProduct: false,
            precautionaryStatements: [],
            hazards: [],
            name: "Gouda 28%",
            code: "101230572_KG",
            manufacturer: "Eldorado",
            categoryName: "Mejeri, ost & ägg",
            volume: "ca: 1.2kg",
            displayVolume: "ca: 1.2kg",
            url: "/handla/varor/gouda-28-eldorado-101230572",
            stock: {
              stockLevelStatus: "inStock",
              stockLevel: 999,
            },
            averageRating: 4.2,
            numberOfReviews: 156,
            badges: ["popular"],
          },
          {
            potentialPromotions: [{ type: "DISCOUNT", value: "10%" }],
            priceValue: 22.9,
            price: "22,90 kr",
            name: "Naturell Färskost 23%",
            code: "101244012_ST",
            manufacturer: "Eldorado",
            categoryName: "Mejeri, ost & ägg",
            volume: "300g",
            displayVolume: "300g",
            url: "/handla/varor/naturell-farskost-23-eldorado-101244012",
            stock: {
              stockLevelStatus: "inStock",
              stockLevel: 45,
            },
            image: {
              url: "https://assets.axfood.se/image/upload/f_auto,t_200/07311041234567_C1L1_s02",
            },
          },
        ],
      }),

      mjölk: JSON.stringify({
        results: [
          {
            name: "Standardmjölk 3%",
            code: "101175556_ST",
            price: "14,90 kr",
            priceValue: 14.9,
            manufacturer: "Arla",
            categoryName: "Mejeri, ost & ägg",
            volume: "1l",
            stock: { stockLevelStatus: "inStock", stockLevel: 120 },
            potentialPromotions: [],
            image: {
              url: "https://assets.axfood.se/image/upload/f_auto,t_200/07340083467875_C1L1_s02",
            },
          },
        ],
      }),

      invalid: '{"malformed": json}', // Invalid JSON for error testing

      empty: JSON.stringify({ results: [] }),
    };
  }

  // Mock the parsing logic from mcpSearchProducts
  parseSearchResponse(htmlData) {
    let products = [];
    try {
      let searchData = null;

      if (htmlData.startsWith("{")) {
        // Direct JSON response
        searchData = JSON.parse(htmlData);
      } else {
        // Look for JSON in HTML script tag
        const scriptMatch = htmlData.match(
          /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
        );
        if (scriptMatch) {
          const nextData = JSON.parse(scriptMatch[1]);
          searchData = nextData?.props?.pageProps?.searchResults;
        }
      }

      if (searchData?.results) {
        products = searchData.results.map((product) => ({
          name: product.name,
          code: product.code,
          price: product.price,
          priceValue: product.priceValue,
          manufacturer: product.manufacturer,
          categoryName: product.categoryName,
          potentialPromotions: product.potentialPromotions || [],
          stock: {
            stockLevelStatus: product.stock?.stockLevelStatus || "unknown",
            stockLevel: product.stock?.stockLevel || 0,
          },
          image: product.image
            ? {
                url: product.image.url,
              }
            : null,
          volume: product.volume || product.displayVolume,
          url: product.url,
          averageRating: product.averageRating,
          numberOfReviews: product.numberOfReviews,
          badges: product.badges || [],
        }));
      }
    } catch (parseError) {
      throw new Error(`Failed to parse search results: ${parseError.message}`);
    }

    return {
      success: true,
      products,
      totalResults: products.length,
      message: `Found ${products.length} products`,
    };
  }

  async test(name, testFn) {
    try {
      console.log(`\\n🧪 Testing: ${name}`);
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.testResults.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name} - ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push({ name, error: error.message });
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  async runParsingTests() {
    console.log("🧬 PARSING VALIDATION TESTS WITH SNAPSHOTS");
    console.log("=".repeat(50));

    const snapshots = this.getSearchSnapshot();

    await this.test('Parse "ost" Search Response', () => {
      const result = this.parseSearchResponse(snapshots.ost);

      this.assert(result.success, "Should parse successfully");
      this.assert(result.products.length === 2, "Should find 2 products");
      this.assert(result.totalResults === 2, "Total results should be 2");

      // Validate first product structure
      const firstProduct = result.products[0];
      this.assert(
        firstProduct.name === "Gouda 28%",
        "First product name should be Gouda 28%",
      );
      this.assert(
        firstProduct.code === "101230572_KG",
        "Product code should match",
      );
      this.assert(
        firstProduct.price === "84,90 kr",
        "Price should be formatted",
      );
      this.assert(
        firstProduct.priceValue === 84.9,
        "Price value should be numeric",
      );
      this.assert(
        firstProduct.manufacturer === "Eldorado",
        "Manufacturer should match",
      );
      this.assert(
        firstProduct.categoryName === "Mejeri, ost & ägg",
        "Category should match",
      );
      this.assert(firstProduct.volume === "ca: 1.2kg", "Volume should match");
      this.assert(
        firstProduct.stock.stockLevelStatus === "inStock",
        "Stock status should match",
      );
      this.assert(
        firstProduct.stock.stockLevel === 999,
        "Stock level should match",
      );
      this.assert(
        firstProduct.image.url.includes("axfood.se"),
        "Image URL should be valid",
      );
      this.assert(firstProduct.averageRating === 4.2, "Rating should match");
      this.assert(
        firstProduct.numberOfReviews === 156,
        "Review count should match",
      );
      this.assert(Array.isArray(firstProduct.badges), "Badges should be array");
      this.assert(
        Array.isArray(firstProduct.potentialPromotions),
        "Promotions should be array",
      );

      console.log("   📦 First product: Gouda 28% - 84,90 kr");
      console.log("   📊 Structure validation complete");
    });

    await this.test('Parse "mjölk" Search Response', () => {
      const result = this.parseSearchResponse(snapshots.mjölk);

      this.assert(result.success, "Should parse successfully");
      this.assert(result.products.length === 1, "Should find 1 product");

      const product = result.products[0];
      this.assert(
        product.name === "Standardmjölk 3%",
        "Product name should match",
      );
      this.assert(product.manufacturer === "Arla", "Manufacturer should match");
      this.assert(product.volume === "1l", "Volume should match");

      console.log("   🥛 Product: Standardmjölk 3% - 14,90 kr (Arla)");
    });

    await this.test("Handle Empty Results", () => {
      const result = this.parseSearchResponse(snapshots.empty);

      this.assert(result.success, "Should parse successfully");
      this.assert(result.products.length === 0, "Should have no products");
      this.assert(result.totalResults === 0, "Total results should be 0");
      this.assert(
        result.message.includes("0 products"),
        "Message should indicate no products",
      );

      console.log("   📭 Empty results handled correctly");
    });

    await this.test("Handle Invalid JSON", () => {
      try {
        this.parseSearchResponse(snapshots.invalid);
        throw new Error("Should have thrown an error");
      } catch (error) {
        this.assert(
          error.message.includes("Failed to parse"),
          "Should throw parsing error",
        );
        console.log("   🚫 Invalid JSON error handling works");
      }
    });

    await this.test("Handle HTML with Script Tag (Legacy Format)", () => {
      const htmlWithScript = `
        <html>
          <head>
            <script id="__NEXT_DATA__" type="application/json">
              {"props":{"pageProps":{"searchResults":${snapshots.mjölk}}}}
            </script>
          </head>
        </html>
      `;

      const result = this.parseSearchResponse(htmlWithScript);

      this.assert(result.success, "Should parse HTML with script tag");
      this.assert(
        result.products.length === 1,
        "Should extract product from script tag",
      );

      console.log("   🏷️ HTML script tag parsing works");
    });

    await this.test("Product Field Validation", () => {
      const result = this.parseSearchResponse(snapshots.ost);
      const product = result.products[0];

      // Test all expected fields exist
      const requiredFields = [
        "name",
        "code",
        "price",
        "priceValue",
        "manufacturer",
        "categoryName",
        "potentialPromotions",
        "stock",
        "image",
        "volume",
        "url",
        "averageRating",
        "numberOfReviews",
        "badges",
      ];

      requiredFields.forEach((field) => {
        this.assert(
          Object.hasOwn(product, field),
          `Product should have ${field} field`,
        );
      });

      // Test nested structure
      this.assert(typeof product.stock === "object", "Stock should be object");
      this.assert(product.stock.stockLevelStatus, "Stock should have status");
      this.assert(
        typeof product.stock.stockLevel === "number",
        "Stock level should be number",
      );

      console.log("   🔍 All required fields present and typed correctly");
    });

    await this.test("Save Snapshots to File", () => {
      // Save snapshots for future reference
      const snapshotFile = path.join(
        snapshotsDir,
        "willys-search-responses.json",
      );
      const snapshotData = {
        created: new Date().toISOString(),
        description: "Presaved Willys HTTP response snapshots for testing",
        snapshots: snapshots,
      };

      fs.writeFileSync(snapshotFile, JSON.stringify(snapshotData, null, 2));

      this.assert(
        fs.existsSync(snapshotFile),
        "Snapshot file should be created",
      );
      console.log(`   💾 Snapshots saved to: ${snapshotFile}`);
    });

    // === RESULTS ===
    console.log(`\\n${"=".repeat(50)}`);
    console.log("📈 PARSING VALIDATION RESULTS");
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);

    if (this.testResults.errors.length > 0) {
      console.log("\\n🚨 FAILED TESTS:");
      this.testResults.errors.forEach(({ name, error }) => {
        console.log(`   • ${name}: ${error}`);
      });
    }

    const successRate =
      (this.testResults.passed /
        (this.testResults.passed + this.testResults.failed)) *
      100;
    console.log(`\\n📊 Success Rate: ${successRate.toFixed(1)}%`);

    if (successRate >= 90) {
      console.log("🎉 Parsing validation PASSED!");
    } else {
      console.log("💥 Parsing validation FAILED!");
    }

    return successRate >= 90;
  }
}

// Run parsing tests
if (require.main === module) {
  const tests = new ParsingValidationTests();
  tests.runParsingTests().catch(console.error);
}

module.exports = ParsingValidationTests;
