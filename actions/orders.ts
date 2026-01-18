"use server";

import {
  fetchCsrfToken,
  fetchWithRetry,
  getApiHeaders,
  getErrorMessage,
} from "@/lib/request-utils";
import type {
  RawCartResponse,
  RawCustomerResponse,
  RawDeliveryDay,
  RawDeliverySlot,
  RawOrder,
  RawOrderDetails,
  RawPickupSlot,
  RawPickupSlotsResponse,
  RawPrice,
  RawProduct,
  RawSavedCard,
  RawSlotSelectionResponse,
  TmsSlotData,
  WillysCart,
  WillysCost,
  WillysCustomer,
  WillysDeliverySlotsResponse,
  WillysOrder,
  WillysOrderItem,
  WillysPickupSlot,
  WillysPickupSlotsResponse,
  WillysSmartMatchResponse,
} from "@/lib/types";
import { getWillysCookies } from "./auth";

function parseCurrencyToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  let s = value.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.indexOf(".") < s.indexOf(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function mapRawPriceToCost(raw: RawPrice | undefined): WillysCost {
  return {
    currencyIso: raw?.currencyIso || "SEK",
    value: raw?.value || 0,
    priceType: raw?.priceType || "",
    formattedValue: raw?.formattedValue || "",
  };
}

function mapRawPickupSlotToWillysSlot(
  slot: RawPickupSlot,
  storeId: string,
): WillysPickupSlot {
  return {
    pickingCost: mapRawPriceToCost(slot.pickingCost),
    pickUpCost: mapRawPriceToCost(slot.pickUpCost),
    pickUpExternalLocationCost: mapRawPriceToCost(
      slot.pickUpExternalLocationCost,
    ),
    deliveryCost: mapRawPriceToCost(slot.deliveryCost),
    freeDeliveryThreshold: slot.freeDeliveryThreshold
      ? mapRawPriceToCost(slot.freeDeliveryThreshold)
      : undefined,
    freePickUpThreshold: slot.freePickUpThreshold
      ? mapRawPriceToCost(slot.freePickUpThreshold)
      : undefined,
    freePickingThreshold: slot.freePickingThreshold
      ? mapRawPriceToCost(slot.freePickingThreshold)
      : undefined,
    b2b: slot.b2b || false,
    deliverySlot: slot.deliverySlot || false,
    expressSlot: slot.expressSlot || false,
    orderLatestDeliveryTime: slot.orderLatestDeliveryTime || 0,
    orderEarliestDeliveryTime: slot.orderEarliestDeliveryTime || 0,
    slotBaseStoreId: slot.slotBaseStoreId || "",
    dayOfTheWeek: slot.dayOfTheWeek || "",
    formattedTime: slot.formattedTime || "",
    closeTimeFormatted: slot.closeTimeFormatted || "",
    closeTime: slot.closeTime || 0,
    totalCost: mapRawPriceToCost(slot.totalCost),
    earlyCloseTime: slot.earlyCloseTime || false,
    tmsDeliveryWindowReference: slot.tmsDeliveryWindowReference,
    pickupStoreId: slot.pickupStoreId || storeId,
    available: slot.available || false,
    startTime: slot.startTime || 0,
    code: slot.code || "",
    endTime: slot.endTime || 0,
  };
}

function toIsoDateFromMillis(millis?: unknown): string {
  if (typeof millis === "number" && Number.isFinite(millis)) {
    try {
      return new Date(millis).toISOString();
    } catch {
      return "";
    }
  }
  return "";
}

function mapRawProductToItem(
  raw: RawProduct,
  fallbackCategory?: string,
): WillysOrderItem {
  const id: string = String(
    raw.code ?? raw.id ?? crypto.randomUUID?.() ?? Math.random(),
  );
  const imageUrl: string | undefined =
    raw.image?.url ?? raw.thumbnail?.url ?? undefined;
  const totalPriceStr: string | undefined =
    raw.totalDiscountedPrice ??
    (typeof raw.totalPrice === "string"
      ? raw.totalPrice
      : raw.totalPrice?.formattedValue);
  const unitPriceValue: number | undefined =
    typeof raw.priceValue === "number" ? raw.priceValue : undefined;
  const priceNumber = totalPriceStr
    ? parseCurrencyToNumber(totalPriceStr)
    : (unitPriceValue ?? 0);
  const quantityNumber: number =
    typeof raw.pickQuantity === "number"
      ? raw.pickQuantity
      : typeof raw.quantity === "number"
        ? raw.quantity
        : typeof raw.originalPickQuantity === "number"
          ? raw.originalPickQuantity
          : 1;

  return {
    id,
    name: String(raw.name ?? raw.productLine2 ?? ""),
    quantity: quantityNumber,
    price: priceNumber,
    imageUrl,
    brand: raw.manufacturer ?? undefined,
    category: raw.categoryName ?? fallbackCategory ?? undefined,
    productCode: raw.code ?? raw.productCodePost ?? undefined,
  };
}

function mapOrderDetailsToWillysOrder(raw: RawOrderDetails): WillysOrder {
  const deliveredByCategory = raw.categoryOrderedDeliveredProducts;
  const partiallyDelivered: RawProduct[] = Array.isArray(
    raw.partiallyDeliveredProducts,
  )
    ? raw.partiallyDeliveredProducts
    : [];

  const itemsMap = new Map<string, WillysOrderItem>();

  if (deliveredByCategory && typeof deliveredByCategory === "object") {
    for (const [categoryName, products] of Object.entries(
      deliveredByCategory,
    )) {
      if (Array.isArray(products)) {
        for (const p of products) {
          const item = mapRawProductToItem(p, categoryName);
          const existing = itemsMap.get(item.id);
          if (existing) {
            itemsMap.set(item.id, {
              ...existing,
              quantity: existing.quantity + item.quantity,
              price: existing.price + item.price,
            });
          } else {
            itemsMap.set(item.id, item);
          }
        }
      }
    }
  }

  for (const p of partiallyDelivered) {
    const item = mapRawProductToItem(p, p.categoryName);
    const existing = itemsMap.get(item.id);
    if (existing) {
      itemsMap.set(item.id, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        price: existing.price + item.price,
      });
    } else {
      itemsMap.set(item.id, item);
    }
  }

  const items: WillysOrderItem[] = Array.from(itemsMap.values());

  const msDelivery =
    (typeof raw.requestedDelivery === "number" && raw.requestedDelivery) ||
    (typeof raw.estimatedDelivery === "number" && raw.estimatedDelivery) ||
    (typeof raw.slotStartDateTime === "number" && raw.slotStartDateTime) ||
    (typeof raw.slot?.startTime === "number" && raw.slot.startTime) ||
    undefined;

  const statusCode: string | undefined =
    raw.orderStatus?.code ??
    (typeof raw.status === "string" ? raw.status : undefined);
  const completed: boolean = Boolean(raw.completed);
  const status: string =
    completed || statusCode === "COMPLETED" ? "delivered" : "pending";

  const total: number =
    (raw.totalPrice &&
      parseCurrencyToNumber(
        raw.totalPrice.value ?? raw.totalPrice.formattedValue,
      )) ||
    (raw.nettoTotalCost &&
      parseCurrencyToNumber(
        raw.nettoTotalCost.value ?? raw.nettoTotalCost.formattedValue,
      )) ||
    0;

  return {
    orderNumber: String(raw.orderNumber ?? raw.code ?? ""),
    deliveryDate: toIsoDateFromMillis(msDelivery),
    status,
    total,
    items,
  };
}

export async function getOrders(): Promise<WillysOrder[]> {
  try {
    const cookies = await getWillysCookies();
    console.log("Using cookies for orders request");

    const response = await fetchWithRetry(
      "https://www.willys.se/axfood/rest/account/orders",
      { headers: getApiHeaders(cookies) },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status}`);
    }

    const data = await response.json();

    // Debug: log the actual structure we get from Willys API
    console.log("Raw Willys API response:", JSON.stringify(data, null, 2));

    const rawOrders: RawOrder[] = Array.isArray(data)
      ? data
      : data.orders || [];

    const mapped: WillysOrder[] = rawOrders.map((o: RawOrder) => {
      // Use formatted date strings from API in ISO date format (YYYY-MM-DD)
      const deliveryDate =
        o.deliveryFormattedDate || o.formattedOrderDate || "";

      const statusCode: string | undefined =
        (typeof o.status === "object" ? o.status?.code : undefined) ??
        o.orderStatus?.code ??
        (typeof o.status === "string" ? o.status : undefined);
      const completed: boolean = Boolean(o.complete || o.completed);
      const status: string =
        completed || statusCode === "COMPLETED" ? "delivered" : "pending";

      const total: number =
        parseCurrencyToNumber(o.total) ||
        parseCurrencyToNumber(o.reservedAmount) ||
        (o.totalPrice &&
          parseCurrencyToNumber(
            o.totalPrice.value ?? o.totalPrice.formattedValue,
          )) ||
        (o.nettoTotalCost &&
          parseCurrencyToNumber(
            o.nettoTotalCost.value ?? o.nettoTotalCost.formattedValue,
          )) ||
        0;

      return {
        orderNumber: String(o.orderNumber ?? o.code ?? o.guid ?? ""),
        deliveryDate,
        status,
        total,
        items: [], // Items will be loaded separately via getOrderDetails()
      };
    });

    // Debug: log the processed orders
    console.log("Processed orders (mapped):", mapped);

    return mapped;
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export async function getOrderDetails(
  orderNumber: string,
): Promise<WillysOrder | null> {
  try {
    const cookies = await getWillysCookies();

    const response = await fetchWithRetry(
      `https://www.willys.se/axfood/rest/orderdata?q=${orderNumber}`,
      { headers: getApiHeaders(cookies) },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch order details: ${response.status}`);
    }

    const data: RawOrderDetails = await response.json();
    const mapped = mapOrderDetailsToWillysOrder(data);
    return mapped;
  } catch (error) {
    console.error("Error fetching order details:", error);
    return null;
  }
}

export async function addToCart(
  productCode: string,
  quantity: number = 1,
): Promise<{ success: boolean; message?: string }> {
  try {
    const cookies = await getWillysCookies();
    const csrfToken = await fetchCsrfToken(cookies);

    const response = await fetchWithRetry(
      "https://www.willys.se/axfood/rest/cart/addProducts",
      {
        method: "POST",
        headers: getApiHeaders(cookies, csrfToken),
        body: JSON.stringify({
          products: [
            {
              productCodePost: productCode,
              qty: quantity,
              pickUnit: "pieces",
              hideDiscountToolTip: false,
              noReplacementFlag: false,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to add to cart: ${response.status} - ${errorText}`,
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Error adding to cart:", error);
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function getCustomerInfo(): Promise<WillysCustomer | null> {
  try {
    const cookies = await getWillysCookies();

    const response = await fetchWithRetry(
      "https://www.willys.se/axfood/rest/customer",
      {
        headers: {
          ...getApiHeaders(cookies),
          dnt: "1",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch customer info: ${response.status}`);
    }

    const data: RawCustomerResponse = await response.json();

    // Map the response to our customer type
    const customer: WillysCustomer = {
      uid: data.uid || "",
      name: data.name || "",
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || "",
      displayUid: data.displayUid || "",
      socialSecurityNumber: data.socialSecurityNumer, // Note: typo in API response
      defaultBillingAddress: data.defaultBillingAddress
        ? {
            id: data.defaultBillingAddress.id || "",
            firstName: data.defaultBillingAddress.firstName || "",
            lastName: data.defaultBillingAddress.lastName || "",
            line1: data.defaultBillingAddress.line1 || "",
            line2: data.defaultBillingAddress.line2,
            town: data.defaultBillingAddress.town || "",
            postalCode: data.defaultBillingAddress.postalCode || "",
            phone: data.defaultBillingAddress.phone,
            cellphone: data.defaultBillingAddress.cellphone,
            email: data.defaultBillingAddress.email || "",
            country: {
              isocode: data.defaultBillingAddress.country?.isocode || "",
              name: data.defaultBillingAddress.country?.name || "",
            },
            formattedAddress: data.defaultBillingAddress.formattedAddress || "",
          }
        : undefined,
      defaultShippingAddress: data.defaultShippingAddress
        ? {
            id: data.defaultShippingAddress.id || "",
            firstName: data.defaultShippingAddress.firstName || "",
            lastName: data.defaultShippingAddress.lastName || "",
            line1: data.defaultShippingAddress.line1 || "",
            line2: data.defaultShippingAddress.line2,
            town: data.defaultShippingAddress.town || "",
            postalCode: data.defaultShippingAddress.postalCode || "",
            phone: data.defaultShippingAddress.phone,
            cellphone: data.defaultShippingAddress.cellphone,
            email: data.defaultShippingAddress.email || "",
            country: {
              isocode: data.defaultShippingAddress.country?.isocode || "",
              name: data.defaultShippingAddress.country?.name || "",
            },
            formattedAddress:
              data.defaultShippingAddress.formattedAddress || "",
          }
        : undefined,
      savedCards:
        data.savedCards?.map((card: RawSavedCard) => ({
          id: card.id || "",
          maskedNumber: card.maskedNumber || "",
          cardType: card.cardType || "",
          expired: card.expired || false,
          defaultCard: card.defaultCard || false,
          expireDate: card.expireDate || "",
        })) || [],
      bonusInfo: {
        bonusAmountCurrentMonth: data.bonusInfo?.bonusAmountCurrentMonth || "0",
        currentTierName: data.bonusInfo?.currentTierName || "",
        totalDiscountCurrentMonth:
          data.bonusInfo?.totalDiscountCurrentMonth || "0",
        totalDiscountCurrentYear:
          data.bonusInfo?.totalDiscountCurrentYear || "0",
        currentBonusLevelEndDate:
          data.bonusInfo?.currentBonusLevelEndDate || "",
        daysLeftOnCurrentPeriod: data.bonusInfo?.daysLeftOnCurrentPeriod || 0,
        currentBonusVoucherPoints:
          data.bonusInfo?.currentBonusVoucherPoints || 0,
      },
      memberCreationMonthAndYear: data.memberCreationMonthAndYear || "",
      memberCreationDateFull: data.memberCreationDateFull || "",
      newCustomer: data.newCustomer || false,
    };

    return customer;
  } catch (error) {
    console.error("Error fetching customer info:", error);
    return null;
  }
}

export async function getCart(): Promise<WillysCart | null> {
  try {
    const cookies = await getWillysCookies();
    const csrfToken = await fetchCsrfToken(cookies);

    const response = await fetchWithRetry(
      "https://www.willys.se/axfood/rest/cart",
      {
        headers: {
          ...getApiHeaders(cookies, csrfToken),
          dnt: "1",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch cart: ${response.status}`);
    }

    const data: RawCartResponse = await response.json();

    // Map the response to our cart type
    const cart: WillysCart = {
      code: data.code || "",
      totalPrice: data.totalPrice || "0,00 kr",
      subTotalPrice: data.subTotalPrice || "0,00 kr",
      totalItems: data.totalItems || 0,
      totalUnitCount: data.totalUnitCount || 0,
      totalDiscount: data.totalDiscount || "0,00 kr",
      totalDiscountValue: data.totalDiscountValue || 0,
      totalTax: data.totalTax || "0,00 kr",
      bufferedAmount: data.bufferedAmount || "0,00 kr",
      reservedAmount: data.reservedAmount || "0,00 kr",
      orderDate: data.orderDate || "",
      deliveryCost: data.deliveryCost || "",
      pickUpCost: data.pickUpCost || "0,00 kr",
      serviceCost: data.serviceCost || "0,00 kr",
      pickAndPackCost: data.pickAndPackCost || "0,00 kr",
      products:
        data.products?.map((product: RawProduct) => ({
          code: product.code || "",
          name: product.name || "",
          price: product.price || "",
          priceValue: product.priceValue || 0,
          totalPrice:
            typeof product.totalPrice === "string"
              ? product.totalPrice
              : product.totalPrice?.formattedValue || "",
          totalDiscountedPrice: product.totalDiscountedPrice || "",
          quantity: product.quantity || 0,
          pickQuantity: product.pickQuantity || 0,
          categoryName: product.categoryName || "",
          manufacturer: product.manufacturer,
          displayVolume: product.displayVolume || "",
          image: product.image
            ? {
                url: product.image.url || "",
                altText: product.image.altText || "",
              }
            : undefined,
          thumbnail: product.thumbnail
            ? {
                url: product.thumbnail.url || "",
                altText: product.thumbnail.altText || "",
              }
            : undefined,
          unit: {
            code:
              (typeof product.unit === "object"
                ? product.unit?.code
                : undefined) || "",
            name:
              (typeof product.unit === "object"
                ? product.unit?.name
                : undefined) || "",
          },
          pickUnit: {
            code:
              (typeof product.pickUnit === "object"
                ? product.pickUnit?.code
                : undefined) || "",
            name:
              (typeof product.pickUnit === "object"
                ? product.pickUnit?.name
                : undefined) || "",
          },
          totalDiscount: product.totalDiscount || "0,00 kr",
          totalDiscountValue: product.totalDiscountValue || 0,
          outOfStock: product.outOfStock || false,
          canBeReplaced: product.canBeReplaced || false,
          doNotReplace: product.doNotReplace || false,
        })) || [],
    };

    return cart;
  } catch (error) {
    console.error("Error fetching cart:", error);
    return null;
  }
}

export async function getDeliverySlots(
  postalCode: string,
): Promise<WillysDeliverySlotsResponse | null> {
  try {
    const cookies = await getWillysCookies();

    const response = await fetchWithRetry(
      `https://www.willys.se/axfood/rest/checkout/deliverytimes/available?postalCode=${postalCode}&storeCode=willys&targetDate=&page=0&pageSize=20`,
      {
        headers: {
          ...getApiHeaders(cookies),
          dnt: "1",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch delivery slots: ${response.status}`);
    }

    const data: { deliveryDays?: RawDeliveryDay[] } = await response.json();

    // Map the response to our delivery slots type
    const deliveryDays =
      data.deliveryDays?.map((day: RawDeliveryDay) => ({
        date: day.date || "",
        formattedDate: day.formattedDate || "",
        slots:
          day.slots?.map((slot: RawDeliverySlot) => ({
            formattedTime: slot.formattedTime || "",
            totalCost: slot.totalCost || "",
            totalCostValue: slot.totalCostValue || 0,
            available: slot.available || false,
            closeTimeFormatted: slot.closeTimeFormatted || "",
            closeTime: slot.closeTime || "",
            startTime: slot.startTime || "",
            endTime: slot.endTime || "",
            slotId: slot.slotId || "",
            date: slot.date || "",
            type: slot.type || "delivery",
            fullyBooked: slot.fullyBooked || false,
            limitReached: slot.limitReached || false,
            deliveryMethod: slot.deliveryMethod || "delivery",
            tmsDeliveryWindowReference: slot.tmsDeliveryWindowReference
              ? {
                  earliestDateTime:
                    slot.tmsDeliveryWindowReference.earliestDateTime || 0,
                  latestDateTime:
                    slot.tmsDeliveryWindowReference.latestDateTime || 0,
                  routeID: slot.tmsDeliveryWindowReference.routeID || 0,
                  resourceKey:
                    slot.tmsDeliveryWindowReference.resourceKey || "",
                  scheduleKey:
                    slot.tmsDeliveryWindowReference.scheduleKey || "",
                  precedingStopId:
                    slot.tmsDeliveryWindowReference.precedingStopId || 0,
                  stopNumber: slot.tmsDeliveryWindowReference.stopNumber || 0,
                  profitability:
                    slot.tmsDeliveryWindowReference.profitability || 0,
                }
              : undefined,
          })) || [],
      })) || [];

    return { deliveryDays };
  } catch (error) {
    console.error("Error fetching delivery slots:", error);
    return null;
  }
}

export async function getPickupSlots(
  storeId: string = "2288",
): Promise<WillysPickupSlotsResponse | null> {
  try {
    const cookies = await getWillysCookies();
    const csrfToken = await fetchCsrfToken(cookies);

    const response = await fetchWithRetry(
      `https://www.willys.se/axfood/rest/slot/pickInStore?storeId=${storeId}&b2b=false`,
      {
        headers: getApiHeaders(cookies, csrfToken),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pickup slots: ${response.status}`);
    }

    const data: RawPickupSlotsResponse = await response.json();

    // Map the response to our pickup slots type
    const pickupResponse: WillysPickupSlotsResponse = {
      isocode: data.isocode || "sv",
      slots:
        data.slots?.map((slot: RawPickupSlot) =>
          mapRawPickupSlotToWillysSlot(slot, storeId),
        ) || [],
      selectedSlot: data.selectedSlot
        ? mapRawPickupSlotToWillysSlot(data.selectedSlot, storeId)
        : undefined,
      tmsSlots: data.tmsSlots || false,
      minimumPickingCost: data.minimumPickingCost
        ? mapRawPriceToCost(data.minimumPickingCost)
        : undefined,
      minimumFreePickingThreshold: data.minimumFreePickingThreshold
        ? mapRawPriceToCost(data.minimumFreePickingThreshold)
        : undefined,
      showExternalPickupLocationNotice:
        data.showExternalPickupLocationNotice || false,
      startDate: data.startDate || "",
      endDate: data.endDate || "",
    };

    return pickupResponse;
  } catch (error) {
    console.error("Error fetching pickup slots:", error);
    return null;
  }
}

export async function selectSlot(
  slotCode: string,
  isTmsSlot: boolean = false,
  tmsData?: TmsSlotData,
): Promise<{ success: boolean; message?: string }> {
  try {
    const cookies = await getWillysCookies();
    const csrfToken = await fetchCsrfToken(cookies);

    const response = await fetchWithRetry(
      `https://www.willys.se/axfood/rest/slot/slotInCart/${encodeURIComponent(slotCode)}?isTmsSlot=${isTmsSlot}`,
      {
        method: "POST",
        headers: getApiHeaders(cookies, csrfToken),
        body: tmsData ? JSON.stringify(tmsData) : null,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slot selection failed:", response.status, errorText);
      throw new Error(
        `Failed to select slot: ${response.status} - ${errorText}`,
      );
    }

    const data: RawSlotSelectionResponse = await response.json();
    console.log("Slot selection response:", data);

    // Check if the slot was successfully selected
    if (data.deliveryTimeSlot || data.slot) {
      return { success: true, message: "Slot selected successfully" };
    } else {
      return {
        success: false,
        message: "Slot selection failed - no slot information in response",
      };
    }
  } catch (error) {
    console.error("Error selecting slot:", error);
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function getOffers(): Promise<unknown> {
  try {
    const cookies = await getWillysCookies();

    const response = await fetchWithRetry(
      "https://www.willys.se/_next/data/a4eecdbf/sv/erbjudanden.json",
      {
        headers: {
          ...getApiHeaders(cookies),
          "if-none-match": '"172l4cwrd5w1r8t"',
          purpose: "prefetch",
          "x-nextjs-data": "1",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch offers: ${response.status}`);
    }

    const data: unknown = await response.json();
    console.log(
      "Offers API response received, data keys:",
      Object.keys(data as Record<string, unknown>),
    );

    return data;
  } catch (error) {
    console.error("Error fetching offers:", error);
    return null;
  }
}

export async function getSmartProductMatches(
  searchTerm: string,
  maxResults: number = 5,
): Promise<WillysSmartMatchResponse> {
  try {
    const cookies = await getWillysCookies();

    if (!cookies) {
      return {
        success: false,
        matches: [],
        message: "Not authenticated",
        searchTerm,
      };
    }

    // Use hybrid search (combines SQL text search with vector similarity)
    const { willysDatabase } = await import("../lib/database");
    const hybridResults = await willysDatabase.hybridSearchProducts(
      searchTerm,
      maxResults,
    );

    console.log(
      `Found ${hybridResults.length} hybrid search matches (text + vector) for web interface`,
    );

    if (hybridResults.length === 0) {
      return {
        success: true,
        matches: [],
        message: `No purchase history found for "${searchTerm}". Try building purchase history by ordering products first.`,
        searchTerm,
      };
    }

    // Transform hybrid results to the expected web format
    const matches = hybridResults.map((hybridMatch) => ({
      product: {
        name: hybridMatch.name,
        code: hybridMatch.productCode,
        brand: hybridMatch.manufacturer || "Unknown brand",
        category: "Unknown category", // Could be enhanced with category lookup if needed
      },
      score: Math.round(hybridMatch.score * 100) / 100,
      frequency: hybridMatch.frequency,
      recentPurchases: hybridMatch.frequency,
      lastPurchased:
        hybridMatch.frequency > 0
          ? new Date().toLocaleDateString("sv-SE")
          : "Never",
      similarity: Math.round(hybridMatch.similarity * 100) / 100,
      source: hybridMatch.source,
    }));

    const result = {
      success: true,
      matches: matches,
      message: `Found ${matches.length} smart hybrid matches for "${searchTerm}" (text + vector similarity)`,
      searchTerm,
    };

    return result;
  } catch (error) {
    console.error("Smart matches error:", error);
    return {
      success: false,
      matches: [],
      message: error instanceof Error ? error.message : "Internal server error",
      searchTerm,
    };
  }
}
