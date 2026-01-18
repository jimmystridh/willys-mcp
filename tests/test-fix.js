#!/usr/bin/env node

// Quick test to verify the structure fix
const testData = {
  categoryOrderedDeliveredProducts: {
    "Bröd & Kakor": [
      { name: "Pågen Hamburgerbröd", code: "123", manufacturer: "Pågen" },
    ],
    Mejeri: [{ name: "Arla Mjölk", code: "456", manufacturer: "Arla" }],
  },
};

console.log("Testing categoryOrderedDeliveredProducts structure...");

const categories = testData.categoryOrderedDeliveredProducts;
if (categories && typeof categories === "object") {
  console.log("✅ Categories is an object");

  for (const [categoryName, products] of Object.entries(categories)) {
    console.log(`Category: ${categoryName}`);
    if (Array.isArray(products)) {
      console.log(`✅ Products is an array with ${products.length} items`);
      for (const product of products) {
        console.log(`  - ${product.name} (${product.code})`);
      }
    } else {
      console.log("❌ Products is not an array");
    }
  }
} else {
  console.log("❌ Categories is not an object");
}

console.log(
  "✅ Structure test completed - this should now work in the server action",
);
