import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LA Confeitaria Artesanal", template: "%s · LA Confeitaria" },
  description: "Produções artesanais de Lilian Azevedo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
