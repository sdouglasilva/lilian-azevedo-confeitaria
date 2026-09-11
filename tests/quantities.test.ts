import test from "node:test";
import assert from "node:assert/strict";
import { productionQuantities } from "../domain/productions/quantities.ts";

test("quanto produzir separa produtos homônimos e soma somente os pagos", () => {
  const item = (id: string, quantity: number) => ({ quantity, production_items: { product_id: id, products: { name: "Brigadeiro" } } });
  const result = productionQuantities([
    { status: "PAYMENT_CONFIRMED", order_items: [item("a", 2), item("b", 3)] },
    { status: "PAYMENT_CONFIRMED", order_items: [item("a", 1)] },
    ...["AWAITING_PAYMENT", "COMPLETED", "EXPIRED", "CANCELLED"].map((status) => ({ status, order_items: [item("a", 50)] })),
  ]);
  assert.deepEqual(result, [{ id: "a", name: "Brigadeiro", quantity: 3 }, { id: "b", name: "Brigadeiro", quantity: 3 }]);
});
