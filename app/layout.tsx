import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arte pela Basílica — 10 de setembro de 2026",
  description: "Uma seleção especial de quase 60 obras em benefício da Basílica. Evento em 10 de setembro e catálogo online até 17 de setembro de 2026.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
