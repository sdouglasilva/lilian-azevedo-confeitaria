export type ContactInput = { name: string; email: string; phone: string };

export function normalizeContact(input: ContactInput): ContactInput {
  return {
    name: input.name.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.replace(/\D/g, ""),
  };
}

export function validateContact(input: ContactInput): string | null {
  const contact = normalizeContact(input);
  if (contact.name.length < 2 || contact.name.length > 120) return "Informe seu nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || contact.email.length > 254) return "Informe um e-mail válido.";
  if (![10, 11, 12, 13, 14, 15].includes(contact.phone.length)) return "Informe um telefone válido com DDD.";
  return null;
}

export function parsePositiveInt(value: unknown, max = 9999): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}
