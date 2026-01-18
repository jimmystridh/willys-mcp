"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { addToCart } from "@/actions/orders";
import type { WillysOrderItem } from "@/lib/types";

interface ChecklistItemProps {
  item: WillysOrderItem;
  orderId: string;
  onToggle: (itemId: string, checked: boolean) => void;
}

export default function ChecklistItem({
  item,
  orderId,
  onToggle,
}: ChecklistItemProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`checklist-${orderId}-${item.id}`);
    setIsChecked(saved === "true");
  }, [orderId, item.id]);

  const handleToggle = () => {
    const newChecked = !isChecked;
    setIsChecked(newChecked);
    localStorage.setItem(`checklist-${orderId}-${item.id}`, String(newChecked));
    onToggle(item.id, newChecked);
  };

  const handleAddToCart = async () => {
    if (!item.productCode) {
      alert("Product code not available");
      return;
    }

    setIsAdding(true);
    try {
      const result = await addToCart(item.productCode, item.quantity);
      if (result.success) {
        alert("Added to cart!");
      } else {
        alert(`Failed to add to cart: ${result.message}`);
      }
    } catch (_error) {
      alert("Error adding to cart");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg transition-colors ${
        isChecked ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start space-x-3">
        <button
          type="button"
          onClick={handleToggle}
          className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
            isChecked
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-green-500"
          }`}
        >
          {isChecked && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <title>Checked</title>
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3
              className={`font-medium ${
                isChecked ? "line-through text-gray-500" : "text-gray-900"
              }`}
            >
              {item.name}
            </h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-green-600">
                {item.price ? `${item.price} kr` : "Price not available"}
              </span>
              {item.productCode && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "Add to Cart"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
            <span>Quantity: {item.quantity}</span>
            {item.brand && <span>Brand: {item.brand}</span>}
            {item.category && <span>Category: {item.category}</span>}
          </div>

          {item.imageUrl && (
            <div className="mt-2">
              <Image
                src={item.imageUrl}
                alt={item.name}
                width={64}
                height={64}
                className="object-cover rounded-md"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
