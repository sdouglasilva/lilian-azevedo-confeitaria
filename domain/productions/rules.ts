export type ProductionMode = "SURVEY" | "RESERVATION";
export type ProductionStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "COMPLETED" | "CANCELLED";

export function productionLabel(mode: ProductionMode, status: ProductionStatus) {
  if (status === "ACTIVE") return mode === "SURVEY" ? "Sondagem" : "Reservas abertas";
  return ({ DRAFT: "Rascunho", CLOSED: "Encerrada", COMPLETED: "Concluída", CANCELLED: "Cancelada" } as const)[status];
}
