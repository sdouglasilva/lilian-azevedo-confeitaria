const labels: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento", PAYMENT_CONFIRMED: "Pagamento confirmado", EXPIRED: "Expirado",
  CANCELLED: "Cancelado", COMPLETED: "Concluído", DRAFT: "Rascunho", ACTIVE: "Ativa", CLOSED: "Encerrada",
  WITHDRAWN: "Retirado",
};
export function StatusChip({ status }: { status: string }) {
  return <span className={`status status-${status.toLowerCase()}`}>{labels[status] || status}</span>;
}
