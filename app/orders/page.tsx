import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated, logout } from "@/actions/auth";
import { getCart, getCustomerInfo, getOrders } from "@/actions/orders";
import DeliverySlots from "@/components/DeliverySlots";
import PickupSlots from "@/components/PickupSlots";
import SmartProductMatcher from "@/components/SmartProductMatcher";

export default async function OrdersPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/login");
  }

  const [orders, customerInfo, cart] = await Promise.all([
    getOrders(),
    getCustomerInfo(),
    getCart(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Your Willys Orders
            </h1>
            {customerInfo && (
              <div className="mt-2 text-sm text-gray-600">
                Welcome back, {customerInfo.name} ({customerInfo.displayUid})
              </div>
            )}
          </div>
          <div className="flex space-x-4">
            <Link
              href="/offers"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Offers
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

        {customerInfo && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Account Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-green-800">
                  This Month's Savings
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {customerInfo.bonusInfo.totalDiscountCurrentMonth} kr
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-blue-800">
                  This Year's Savings
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {customerInfo.bonusInfo.totalDiscountCurrentYear} kr
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-purple-800">
                  Bonus Tier
                </div>
                <div className="text-2xl font-bold text-purple-900 capitalize">
                  {customerInfo.bonusInfo.currentTierName}
                </div>
              </div>
            </div>
            {customerInfo.defaultShippingAddress && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700">
                  Default Shipping Address
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {customerInfo.defaultShippingAddress.formattedAddress}
                </div>
              </div>
            )}
          </div>
        )}

        {cart && cart.products.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Current Cart
            </h2>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-orange-800">
                    {cart.totalItems} items in cart
                  </span>
                  <div className="text-xs text-orange-600 mt-1">
                    {cart.orderDate}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-900">
                    {cart.totalPrice}
                  </div>
                  {cart.totalDiscountValue > 0 && (
                    <div className="text-sm text-orange-600">
                      -{cart.totalDiscount} discount
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cart.products.map((product) => (
                <div
                  key={product.code}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  {product.thumbnail && (
                    <Image
                      src={product.thumbnail.url}
                      alt={product.thumbnail.altText || product.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {product.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {product.manufacturer} • {product.displayVolume} •{" "}
                      {product.categoryName}
                    </div>
                    <div className="text-sm text-gray-500">
                      Qty: {product.pickQuantity} {product.pickUnit.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {product.totalDiscountedPrice}
                    </div>
                    {product.totalDiscountValue > 0 && (
                      <div className="text-xs text-green-600 line-through">
                        {product.totalPrice}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-right space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span>{cart.subTotalPrice}</span>
                </div>
                {cart.deliveryCost && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Delivery:</span>
                    <span>{cart.deliveryCost}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax:</span>
                  <span>{cart.totalTax}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{cart.totalPrice}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <SmartProductMatcher />

        {customerInfo?.defaultShippingAddress?.postalCode && (
          <DeliverySlots
            postalCode={customerInfo.defaultShippingAddress.postalCode}
          />
        )}

        <PickupSlots storeId="2288" />

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              No orders found. Make sure you're logged in with the correct
              credentials.
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <Link
                key={order.orderNumber}
                href={`/orders/${order.orderNumber}`}
                className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #
                      {typeof order.orderNumber === "string"
                        ? order.orderNumber
                        : "Unknown"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {order.deliveryDate || "Date not available"}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === "delivered"
                        ? "bg-green-100 text-green-800"
                        : order.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status || "Unknown"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">View items →</span>
                  <span className="text-lg font-semibold text-green-600">
                    {order.total ? `${order.total} kr` : "Total not available"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
