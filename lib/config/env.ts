const read = (name: string) => process.env[name]?.trim() || "";

export const publicConfig = () => ({
  appUrl: read("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  timezone: read("APP_TIMEZONE") || "America/Sao_Paulo",
  locale: read("APP_LOCALE") || "pt-BR",
});

export const paymentConfig = () => ({
  pixKey: read("PIX_KEY"),
  recipientName: read("PIX_RECIPIENT_NAME"),
  instructions: read("PAYMENT_INSTRUCTIONS"),
});

export const emailConfig = () => ({
  apiKey: read("BREVO_API_KEY"),
  from: read("EMAIL_FROM") || "douglas.ernesto.silva@gmail.com",
  fromName: read("EMAIL_FROM_NAME") || "LA Confeitaria Artesanal",
});

export function serverSecret(): string {
  const secret = read("CRON_SECRET");
  if (!secret) throw new Error("CRON_SECRET_NOT_CONFIGURED");
  return secret;
}

export function adminAllowlist(): Set<string> {
  return new Set(
    read("ADMIN_EMAILS")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function requireSupabaseConfig() {
  const config = publicConfig();
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return config;
}
