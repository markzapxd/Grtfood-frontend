import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRT Food — Pedidos de Almoço",
  description:
    "Sistema de gestão de pedidos de almoço — Garten Automação",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
