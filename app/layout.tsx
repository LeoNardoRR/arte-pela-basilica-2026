import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arte pela Basílica — 10 de setembro de 2026",
  description: "Conheça e reserve obras da exposição Arte pela Basílica. Evento em 10 de setembro e catálogo online até 17 de setembro de 2026.",
  openGraph: {
    title: "Arte pela Basílica",
    description: "Uma coleção especial. Um propósito maior.",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Arte pela Basílica — 10 a 17 de setembro de 2026" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arte pela Basílica",
    description: "Uma coleção especial. Um propósito maior.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
