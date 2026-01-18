"use client";

import { useCallback, useEffect, useState } from "react";
import { getPickupSlots, selectSlot } from "@/actions/orders";
import type { WillysPickupSlot, WillysPickupSlotsResponse } from "@/lib/types";

interface PickupSlotsProps {
  storeId?: string;
  onSlotSelect?: (slot: WillysPickupSlot) => void;
}

export default function PickupSlots({
  storeId = "2288",
  onSlotSelect,
}: PickupSlotsProps) {
  const [slotsData, setSlotsData] = useState<WillysPickupSlotsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  const loadPickupSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPickupSlots(storeId);
      setSlotsData(data);
    } catch (err) {
      setError("Failed to load pickup slots");
      console.error("Error loading pickup slots:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadPickupSlots();
  }, [loadPickupSlots]);

  const handleSlotSelect = async (slot: WillysPickupSlot) => {
    setSelecting(slot.code);
    try {
      const result = await selectSlot(slot.code, false);
      if (result.success) {
        setSelectedSlot(slot.code);
        console.log("Selected pickup slot:", slot);
        onSlotSelect?.(slot);
      } else {
        console.error("Failed to select slot:", result.message);
        setError(`Failed to select slot: ${result.message}`);
      }
    } catch (error) {
      console.error("Error selecting slot:", error);
      setError("Error selecting slot");
    } finally {
      setSelecting(null);
    }
  };

  // Get tomorrow's slots by filtering slots that start tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTimestamp = tomorrow.setHours(0, 0, 0, 0);
  const dayAfterTomorrow = tomorrowTimestamp + 24 * 60 * 60 * 1000;

  const tomorrowSlots =
    slotsData?.slots?.filter((slot) => {
      return (
        slot.startTime >= tomorrowTimestamp && slot.startTime < dayAfterTomorrow
      );
    }) || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <span className="ml-3 text-gray-600">Loading pickup slots...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="text-red-600 font-medium mb-2">{error}</div>
          <button
            type="button"
            onClick={loadPickupSlots}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (tomorrowSlots.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Store Pickup Slots for Tomorrow
        </h3>
        <div className="text-center py-8">
          <div className="text-gray-500">
            No pickup slots available for tomorrow
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Store Pickup Slots for Tomorrow
      </h3>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tomorrowSlots.map((slot) => {
          const isSelected = selectedSlot === slot.code;
          const isSelecting = selecting === slot.code;
          const isUnavailable = !slot.available;

          return (
            <button
              type="button"
              key={slot.code}
              onClick={() =>
                !isUnavailable && !isSelecting && handleSlotSelect(slot)
              }
              disabled={isUnavailable || isSelecting}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : isUnavailable || isSelecting
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                    : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-gray-900">
                  {slot.formattedTime}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-600">
                    {slot.totalCost?.formattedValue || "Price unavailable"}
                  </div>
                  <div className="text-xs text-gray-500">Total cost</div>
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                {slot.closeTimeFormatted && (
                  <div>Book by: {slot.closeTimeFormatted}</div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {slot.pickingCost?.formattedValue && (
                    <div>Picking: {slot.pickingCost.formattedValue}</div>
                  )}
                  {slot.pickUpCost?.formattedValue && (
                    <div>Pickup: {slot.pickUpCost.formattedValue}</div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      slot.available
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {slot.available ? "Available" : "Unavailable"}
                  </span>

                  {slot.earlyCloseTime && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      Early Close
                    </span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="mt-2 text-xs font-medium text-blue-600">
                  ✓ Selected
                </div>
              )}

              {isSelecting && (
                <div className="mt-2 text-xs font-medium text-gray-600">
                  Selecting...
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedSlot && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-800">
            Pickup slot selected! Continue with checkout to confirm your
            booking.
          </div>
        </div>
      )}

      {slotsData?.showExternalPickupLocationNotice && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            Note: Some items may require pickup from an external location.
          </div>
        </div>
      )}
    </div>
  );
}
