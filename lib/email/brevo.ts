import { emailConfig } from "@/lib/config/env";

export type EmailMessage = { to: string; subject: string; html: string };
export type EmailSendResult = { status: "sent" | "skipped"; providerId?: string };

const domainOnly = (email: string) => email.split("@")[1] || "invalid";

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const config = emailConfig();
  if (!config.apiKey) {
    console.info("email_adapter_skipped", { recipientDomain: domainOnly(message.to), subjectLength: message.subject.length });
    return { status: "skipped" };
  }
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": config.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: config.from, name: config.fromName },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`BREVO_${response.status}`);
  return { status: "sent", providerId: body.messageId || undefined };
}
