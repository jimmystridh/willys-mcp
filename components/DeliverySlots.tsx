"use client";

import { useCallback, useEffect, useState } from "react";
import { getDeliverySlots, selectSlot } from "@/actions/orders";
import type {
  WillysDeliverySlot,
  WillysDeliverySlotsResponse,
} from "@/lib/types";

interface DeliverySlotsProps {
  postalCode: string;
  onSlotSelect?: (slot: WillysDeliverySlot) => void;
}

export default function DeliverySlots({
  postalCode,
  onSlotSelect,
}: DeliverySlotsProps) {
  const [slotsData, setSlotsData] =
    useState<WillysDeliverySlotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  const loadDeliverySlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDeliverySlots(postalCode);
      setSlotsData(data);
    } catch (err) {
      setError("Failed to load delivery slots");
      console.error("Error loading delivery slots:", err);
    } finally {
      setLoading(false);
    }
  }, [postalCode]);

  useEffect(() => {
    if (postalCode) {
      loadDeliverySlots();
    }
  }, [postalCode, loadDeliverySlots]);

  const handleSlotSelect = async (slot: WillysDeliverySlot) => {
    setSelecting(slot.slotId);
    try {
      // Check if this is a TMS slot (has tmsDeliveryWindowReference)
      const isTmsSlot = !!slot.tmsDeliveryWindowReference;
      const tmsData = slot.tmsDeliveryWindowReference;

      const result = await selectSlot(slot.slotId, isTmsSlot, tmsData);
      if (result.success) {
        setSelectedSlot(slot.slotId);
        console.log("Selected delivery slot:", slot);
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

  // Get tomorrow's date in YYYY-MM-DD format
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  // Find tomorrow's delivery slots
  const tomorrowSlots = slotsData?.deliveryDays?.find(
    (day) => day.date === tomorrowDate,
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <span className="ml-3 text-gray-600">Loading delivery slots...</span>
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
            onClick={loadDeliverySlots}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!tomorrowSlots || tomorrowSlots.slots.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Delivery Slots for {tomorrowSlots?.formattedDate || "Tomorrow"}
        </h3>
        <div className="text-center py-8">
          <div className="text-gray-500">
            No delivery slots available for tomorrow
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Delivery Slots for {tomorrowSlots.formattedDate}
      </h3>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tomorrowSlots.slots.map((slot) => {
          const isSelected = selectedSlot === slot.slotId;
          const isSelecting = selecting === slot.slotId;
          const isUnavailable =
            !slot.available || slot.fullyBooked || slot.limitReached;

          return (
            <button
              type="button"
              key={slot.slotId}
              onClick={() =>
                !isUnavailable && !isSelecting && handleSlotSelect(slot)
              }
              disabled={isUnavailable || isSelecting}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? "border-green-500 bg-green-50"
                  : isUnavailable || isSelecting
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-gray-900">
                  {slot.formattedTime}
                </div>
                {slot.totalCost && (
                  <div className="text-sm font-semibold text-green-600">
                    {slot.totalCost}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                {slot.closeTimeFormatted && (
                  <div>Book by: {slot.closeTimeFormatted}</div>
                )}
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      slot.available && !slot.fullyBooked && !slot.limitReached
                        ? "bg-green-100 text-green-800"
                        : slot.fullyBooked
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {slot.fullyBooked
                      ? "Fully Booked"
                      : slot.limitReached
                        ? "Limit Reached"
                        : slot.available
                          ? "Available"
                          : "Unavailable"}
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="mt-2 text-xs font-medium text-green-600">
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
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-800">
            Delivery slot selected! Continue with checkout to confirm your
            booking.
          </div>
        </div>
      )}
    </div>
  );
}
