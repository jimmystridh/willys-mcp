import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated, logout } from "@/actions/auth";
import { getCustomerInfo, getOffers } from "@/actions/orders";

interface OfferComponent {
  uid?: string;
  name?: string;
  description?: string;
  typeCode?: string;
  headline?: string;
  text?: string;
  products?: unknown[];
  categories?: Array<{ name?: string } | string>;
}

interface SlotData {
  components?: {
    component?: OfferComponent[];
  };
}

interface PageData {
  slots?: SlotData[];
}

interface OffersApiResponse {
  pageProps?: {
    fallback?: Record<string, PageData>;
  };
}

interface ExtractedOffer {
  id: string;
  title: string;
  description: string;
  type?: string;
  products?: unknown[];
  categories?: Array<{ name?: string } | string>;
  content: OfferComponent;
}

// Helper function to extract offers from the API response
function extractOffers(offersData: OffersApiResponse): ExtractedOffer[] {
  if (!offersData?.pageProps?.fallback) return [];

  const fallbackKey = Object.keys(offersData.pageProps.fallback)[0];
  if (!fallbackKey) return [];

  const pageData = offersData.pageProps.fallback[fallbackKey];
  if (!pageData?.slots) return [];

  // Look for offer components in slots
  const offers: ExtractedOffer[] = [];

  for (const slot of pageData.slots) {
    if (slot.components?.component) {
      for (const component of slot.components.component) {
        // Look for promotion/offer components
        if (
          component.typeCode?.includes("Promotion") ||
          component.typeCode?.includes("Offer") ||
          component.typeCode?.includes("Campaign")
        ) {
          offers.push({
            id: component.uid || Math.random().toString(36),
            title: component.name || "Offer",
            description: component.description || "",
            type: component.typeCode,
            content: component,
          });
        }

        // Also check for products or categories that might be part of offers
        if (component.products || component.categories) {
          offers.push({
            id: component.uid || Math.random().toString(36),
            title: component.name || "Special Offer",
            description: component.description || "",
            type: component.typeCode,
            products: component.products,
            categories: component.categories,
            content: component,
          });
        }
      }
    }
  }

  return offers;
}

// Helper function to format offer description
function formatOfferDescription(offer: ExtractedOffer): string {
  if (offer.description) return offer.description;
  if (offer.content?.headline) return offer.content.headline;
  if (offer.content?.text) return offer.content.text;
  if (offer.products) return `${offer.products.length} products on offer`;
  return "Special promotion available";
}

export default async function OffersPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/login");
  }

  const [offersData, customerInfo] = await Promise.all([
    getOffers(),
    getCustomerInfo(),
  ]);

  const offers = offersData ? extractOffers(offersData) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Willys Offers & Promotions
            </h1>
            {customerInfo && (
              <div className="mt-2 text-sm text-gray-600">
                Welcome back, {customerInfo.name} ({customerInfo.displayUid})
              </div>
            )}
          </div>
          <div className="flex space-x-4">
            <Link
              href="/orders"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Orders
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Logout
              </button>
            </form>
          </div>
        </div>

        <div className="mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-green-800">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-green-800">
                  Current Offers Available
                </div>
                <div className="text-sm text-green-600 mt-1">
                  {offers.length === 0
                    ? "Loading offers..."
                    : `Found ${offers.length} active promotions and offers`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {offers.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="text-gray-500 text-lg mb-4">
                {offersData
                  ? "No active offers found at the moment."
                  : "Unable to load offers."}
              </div>
              {offersData !== null && offersData !== undefined && (
                <div className="text-sm text-gray-400">
                  <details>
                    <summary className="cursor-pointer hover:text-gray-600">
                      View raw data structure (debug)
                    </summary>
                    <pre className="mt-4 text-xs text-left overflow-auto bg-gray-50 p-4 rounded border max-h-64">
                      {JSON.stringify(offersData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {offer.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatOfferDescription(offer)}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    {offer.type?.replace(/([A-Z])/g, " $1").trim() || "Offer"}
                  </span>
                </div>

                {offer.products && (
                  <div className="mt-4 text-sm text-gray-600">
                    <span className="font-medium">{offer.products.length}</span>{" "}
                    products included
                  </div>
                )}

                {offer.categories && (
                  <div className="mt-4 text-sm text-gray-600">
                    Categories:{" "}
                    {offer.categories
                      .slice(0, 3)
                      .map((cat) =>
                        typeof cat === "string" ? cat : cat.name || "",
                      )
                      .join(", ")}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      View details →
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Offers are updated regularly. Check back for new promotions!
          </p>
        </div>
      </div>
    </div>
  );
}
