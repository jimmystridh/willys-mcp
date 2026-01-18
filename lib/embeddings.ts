/**
 * Embedding utility functions for vector-based product search
 * Uses OpenAI's text-embedding-3-small model for generating embeddings
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for embeddings to avoid redundant API calls
const embeddingCache = new Map<string, Float32Array>();

/**
 * Generate embedding vector for text using OpenAI API
 * @param text - Text to generate embedding for
 * @returns Float32Array vector (1536 dimensions for text-embedding-3-small)
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Normalize text for consistent embeddings
  const normalizedText = text
    .trim()
    .toLowerCase()
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s+/g, " ");

  // Check cache first
  const cachedEmbedding = embeddingCache.get(normalizedText);
  if (cachedEmbedding !== undefined) {
    console.log(`Embedding cache hit for: "${normalizedText}"`);
    return cachedEmbedding;
  }

  console.log(`Generating embedding for: "${normalizedText}"`);

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: normalizedText,
      encoding_format: "float",
    });

    const embedding = new Float32Array(response.data[0].embedding);

    // Cache the result
    embeddingCache.set(normalizedText, embedding);

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @param batchSize - Number of texts to process per API call (max 100)
 * @returns Array of Float32Array vectors
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 50,
): Promise<Float32Array[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const results: Float32Array[] = [];
  const normalizedTexts = texts.map((text) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[\n\r\t]/g, " ")
      .replace(/\s+/g, " "),
  );

  // Process in batches to respect API limits and cache hits
  for (let i = 0; i < normalizedTexts.length; i += batchSize) {
    const batch = normalizedTexts.slice(i, i + batchSize);
    const batchTexts: string[] = [];
    const batchIndices: number[] = [];

    // Check cache for each item in batch
    const batchResults: Float32Array[] = new Array(batch.length);

    for (let j = 0; j < batch.length; j++) {
      const text = batch[j];
      const cachedEmbedding = embeddingCache.get(text);
      if (cachedEmbedding !== undefined) {
        console.log(`Batch cache hit for: "${text}"`);
        batchResults[j] = cachedEmbedding;
      } else {
        batchTexts.push(text);
        batchIndices.push(j);
      }
    }

    // Generate embeddings for non-cached items
    if (batchTexts.length > 0) {
      console.log(`Generating batch embeddings for ${batchTexts.length} texts`);

      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batchTexts,
          encoding_format: "float",
        });

        // Process batch response
        for (let k = 0; k < response.data.length; k++) {
          const embedding = new Float32Array(response.data[k].embedding);
          const originalIndex = batchIndices[k];
          const text = batchTexts[k];

          batchResults[originalIndex] = embedding;
          embeddingCache.set(text, embedding);
        }
      } catch (error) {
        console.error("Error generating batch embeddings:", error);
        throw error;
      }
    }

    results.push(...batchResults);

    // Rate limiting: wait between batches
    if (i + batchSize < normalizedTexts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Convert Float32Array to BLOB format for SQLite storage
 * @param embedding - Float32Array embedding vector
 * @returns Buffer suitable for BLOB storage
 */
export function embeddingToBlob(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer);
}

/**
 * Convert BLOB from SQLite back to Float32Array
 * @param blob - Buffer from SQLite BLOB column
 * @returns Float32Array embedding vector
 */
export function blobToEmbedding(blob: Buffer): Float32Array {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

/**
 * Calculate cosine similarity between two embeddings
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Cosine similarity score (0-1, where 1 is most similar)
 */
export function cosineSimilarity(
  embedding1: Float32Array,
  embedding2: Float32Array,
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same dimensions");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Clear the embedding cache (useful for testing)
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  console.log("Embedding cache cleared");
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): { size: number; keys: string[] } {
  return {
    size: embeddingCache.size,
    keys: Array.from(embeddingCache.keys()),
  };
}
