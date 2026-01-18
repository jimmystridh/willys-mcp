"use client";

import { useState } from "react";

interface SearchResult {
  productCode: string;
  name: string;
  manufacturer?: string | null;
  similarity?: number;
  frequency?: number;
  score?: number;
  boostedScore?: number;
  categoryBoost?: number;
  finalScore?: number;
  source?: "text" | "vector" | "both";
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  error?: string;
  metadata: {
    algorithm: string;
    description: string;
    searchType: string;
    detectedCategory?: string;
  };
  debug: {
    query: string;
    algorithm: string;
    resultCount: number;
    searchTimeMs: number;
    hasVectorSupport: boolean;
    timestamp: string;
  };
}

const algorithms = [
  {
    id: "vector",
    name: "🧮 Pure Vector/Semantic",
    description:
      "Only semantic similarity using AI embeddings. Best for finding conceptually related items.",
  },
  {
    id: "text",
    name: "📝 Smart Text Search",
    description:
      "Text matching with frequency and recency scoring. Good for exact matches of frequently bought items.",
  },
  {
    id: "hybrid",
    name: "🔄 Hybrid (Current)",
    description:
      "Combines text frequency (60%) with semantic similarity (40%). Balanced approach.",
  },
  {
    id: "vector-boosted",
    name: "🚀 Vector + Frequency Boost",
    description:
      "Semantic search boosted by how often you buy each product. Smart personalization.",
  },
  {
    id: "semantic-first",
    name: "🎯 Semantic First",
    description:
      "High-confidence semantic matches first, text fallback for low confidence. Quality over quantity.",
  },
  {
    id: "category-aware",
    name: "🏷️ Category-Aware",
    description:
      "Detects category intent (ost→dairy) and boosts relevant products. Context understanding.",
  },
];

export default function SearchLab() {
  const [query, setQuery] = useState("ost");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("vector");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState<{
    [key: string]: SearchResponse;
  }>({});

  const search = async (algorithm: string = selectedAlgorithm) => {
    setLoading(true);
    try {
      const response = await fetch("/api/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          algorithm,
          maxResults: 10,
        }),
      });

      const data = await response.json();

      if (compareMode) {
        setCompareResults((prev) => ({ ...prev, [algorithm]: data }));
      } else {
        setResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
    setLoading(false);
  };

  const compareAll = async () => {
    setCompareMode(true);
    setCompareResults({});

    for (const algo of algorithms) {
      await search(algo.id);
      // Small delay to prevent overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  const formatScore = (
    result: SearchResult,
    metadata: SearchResponse["metadata"],
  ) => {
    const type = metadata.searchType;

    if (type === "vector" && result.similarity !== undefined) {
      return `${(result.similarity * 100).toFixed(1)}% similarity`;
    } else if (type === "text" && result.score !== undefined) {
      return `${result.score} score (freq: ${result.frequency || 0})`;
    } else if (type === "hybrid" && result.score !== undefined) {
      return `${result.score.toFixed(1)} score (sim: ${((result.similarity || 0) * 100).toFixed(1)}%)`;
    } else if (type === "vector-boosted" && result.boostedScore !== undefined) {
      return `${result.boostedScore.toFixed(1)} boosted (${((result.similarity ?? 0) * 100).toFixed(1)}% + ${result.frequency || 0}×2)`;
    } else if (type === "category-aware" && result.finalScore !== undefined) {
      return `${result.finalScore.toFixed(2)} final (sim: ${((result.similarity ?? 0) * 100).toFixed(1)}%${result.categoryBoost ? " + category" : ""})`;
    }
    return "N/A";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Willys Search Algorithm Lab
          </h1>
          <p className="text-gray-600">
            Experimental interface to test different search algorithms. Try
            searching for "ost" to see semantic matching in action!
          </p>
        </div>

        {/* Search Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label
                htmlFor="search-query"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Search Query
              </label>
              <input
                id="search-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Try 'ost', 'cheese', 'bröd', etc."
              />
            </div>

            {!compareMode && (
              <div className="flex-1">
                <label
                  htmlFor="algorithm-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Algorithm
                </label>
                <select
                  id="algorithm-select"
                  value={selectedAlgorithm}
                  onChange={(e) => setSelectedAlgorithm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {algorithms.map((algo) => (
                    <option key={algo.id} value={algo.id}>
                      {algo.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {!compareMode && (
              <button
                type="button"
                onClick={() => search()}
                disabled={loading || !query.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "🔍 Searching..." : "🔍 Search"}
              </button>
            )}

            <button
              type="button"
              onClick={compareAll}
              disabled={loading || !query.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "⏳ Comparing..." : "📊 Compare All Algorithms"}
            </button>

            {compareMode && (
              <button
                type="button"
                onClick={() => {
                  setCompareMode(false);
                  setCompareResults({});
                  setResults(null);
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                🔄 Single Mode
              </button>
            )}
          </div>
        </div>

        {/* Algorithm Descriptions */}
        {!compareMode && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Available Algorithms
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {algorithms.map((algo) => (
                <button
                  type="button"
                  key={algo.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors text-left ${
                    selectedAlgorithm === algo.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedAlgorithm(algo.id)}
                >
                  <h4 className="font-medium text-gray-900 mb-2">
                    {algo.name}
                  </h4>
                  <p className="text-sm text-gray-600">{algo.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {compareMode ? (
          /* Comparison View */
          <div className="space-y-6">
            {algorithms.map((algo) => {
              const result = compareResults[algo.id];
              if (!result) return null;

              return (
                <div
                  key={algo.id}
                  className="bg-white rounded-lg shadow-md p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {algo.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {result.metadata.description}
                      </p>
                      {result.metadata.detectedCategory && (
                        <p className="text-sm text-green-600 mt-1">
                          🏷️ Detected category:{" "}
                          {result.metadata.detectedCategory}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div>{result.results.length} results</div>
                      <div>{result.debug.searchTimeMs}ms</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {result.results.slice(0, 5).map((item, index) => (
                      <div
                        key={item.productCode}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                      >
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">
                            #{index + 1} {item.name}
                          </span>
                          {item.manufacturer && (
                            <span className="text-sm text-gray-500 ml-2">
                              by {item.manufacturer}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-mono text-gray-600">
                          {formatScore(item, result.metadata)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Single Result View */
          results && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {results.metadata.algorithm}
                  </h3>
                  <p className="text-gray-600">
                    {results.metadata.description}
                  </p>
                  {results.metadata.detectedCategory && (
                    <p className="text-sm text-green-600 mt-1">
                      🏷️ Detected category: {results.metadata.detectedCategory}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div>{results.results.length} results</div>
                  <div>{results.debug.searchTimeMs}ms</div>
                  <div>
                    Vector support:{" "}
                    {results.debug.hasVectorSupport ? "✅" : "❌"}
                  </div>
                </div>
              </div>

              {results.success ? (
                <div className="space-y-3">
                  {results.results.map((result, index) => (
                    <div
                      key={result.productCode}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            #{index + 1} {result.name}
                          </h4>
                          {result.manufacturer && (
                            <p className="text-sm text-gray-500">
                              by {result.manufacturer}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {result.productCode}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-gray-600">
                            {formatScore(result, results.metadata)}
                          </div>
                          {result.source && (
                            <div className="text-xs text-gray-400">
                              {result.source === "both"
                                ? "📝🧮"
                                : result.source === "text"
                                  ? "📝"
                                  : "🧮"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-red-600">Error: {results.error}</div>
              )}
            </div>
          )
        )}

        {/* Tips */}
        <div className="mt-8 bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            💡 Tips for Testing
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Try "ost" to see semantic matching find cheese products</li>
            <li>
              • Compare "Vector" vs "Text" to see the difference in approaches
            </li>
            <li>
              • Use "Category-Aware" with category terms like "ost", "bröd",
              "kött"
            </li>
            <li>
              • "Vector + Frequency Boost" combines semantic similarity with
              your purchase history
            </li>
            <li>
              • "Semantic First" only shows high-confidence semantic matches
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
