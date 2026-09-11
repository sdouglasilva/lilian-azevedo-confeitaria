type Order = { status?: unknown; order_items?: unknown };

export function productionQuantities(orders: Order[]) {
  const products = new Map<string, { id: string; name: string; quantity: number }>();
  for (const order of orders) {
    if (order.status !== "PAYMENT_CONFIRMED" || !Array.isArray(order.order_items)) continue;
    for (const item of order.order_items) {
      const product = item.production_items;
      if (!product?.product_id) continue;
      const id = String(product.product_id);
      const current = products.get(id) || { id, name: String(product.products?.name || "Produto"), quantity: 0 };
      current.quantity += Number(item.quantity || 0);
      products.set(id, current);
    }
  }
  return [...products.values()];
}
