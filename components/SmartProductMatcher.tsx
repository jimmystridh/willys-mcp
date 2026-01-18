"use client";

import { useState } from "react";
import { getSmartProductMatches } from "@/actions/orders";
import type { WillysSmartMatchResponse } from "@/lib/types";

export default function SmartProductMatcher() {
  const [searchTerm, setSearchTerm] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<WillysSmartMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await getSmartProductMatches(searchTerm.trim(), maxResults);

      if (!data.success) {
        throw new Error(data.message || "Failed to search");
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Smart Product Matcher
        </h2>
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Based on your purchase history
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Try 'mjölk', 'halloumi', 'bröd'..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div className="w-20">
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isLoading || !searchTerm.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Searching..." : "Find"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-blue-800 text-sm">{results.message}</div>
            </div>

            {results.matches.length > 0 && (
              <div className="space-y-3">
                {results.matches.map((match, index) => (
                  <div
                    key={match.product.code}
                    className={`p-4 rounded-lg border-2 ${
                      index === 0
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900">
                            {match.product.name}
                          </h3>
                          {index === 0 && (
                            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                              🎯 Top Choice
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {match.product.brand} • {match.product.category}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Code: {match.product.code}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium text-gray-700">
                          Score: {match.score.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 space-y-1 mt-1">
                          <div>Purchased {match.frequency}× total</div>
                          <div>{match.recentPurchases}× recently</div>
                          <div>Last: {match.lastPurchased}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <strong>How it works:</strong> Searches your purchase history and
          ranks products by frequency, recency, and consistency. Recent
          purchases (within 60 days) get bonus points. Falls back to regular
          search if no history matches.
        </div>
      </div>
    </div>
  );
}
