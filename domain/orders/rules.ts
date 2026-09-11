export type OrderStatus = "AWAITING_PAYMENT" | "PAYMENT_CONFIRMED" | "EXPIRED" | "CANCELLED" | "COMPLETED";

export const countsForProduction = (status: OrderStatus) => status === "PAYMENT_CONFIRMED";
export const occupiesCapacity = (status: OrderStatus, expiresAt: Date, now: Date) =>
  status === "PAYMENT_CONFIRMED" || (status === "AWAITING_PAYMENT" && expiresAt > now);
export const canCustomerCancel = (status: OrderStatus, expiresAt: Date, now: Date) =>
  status === "AWAITING_PAYMENT" && expiresAt > now;
