import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arte pela Basílica — 10 de setembro de 2026",
  description: "Conheça a exposição Arte pela Basílica, escolha obras com valor fixo e registre sua intenção para concluir a compra presencialmente.",
  openGraph: {
    title: "Arte pela Basílica",
    description: "Uma exposição de alto padrão, com valores fixos e compra presencial.",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Arte pela Basílica — 10 a 17 de setembro de 2026" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arte pela Basílica",
    description: "Uma exposição de alto padrão, com valores fixos e compra presencial.",
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
