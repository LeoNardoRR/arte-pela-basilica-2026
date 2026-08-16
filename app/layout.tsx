import type { Metadata } from "next";
import "./globals.css";

export const SITE_URL = "https://arte-pela-basilica-2026.ribeiroleonardoti.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Arte pela Basílica — 10 de setembro de 2026",
  description: "Conheça as 84 obras reais do Vernissage 2026, faça uma pré-reserva temporária e conclua o pagamento presencialmente na Basílica.",
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Arte pela Basílica",
    description: "84 obras reais, pré-reserva temporária e conclusão presencial em favor da restauração da Basílica.",
    url: "/",
    siteName: "Arte pela Basílica",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Arte pela Basílica — 10 a 17 de setembro de 2026" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arte pela Basílica",
    description: "84 obras reais, pré-reserva temporária e conclusão presencial em favor da restauração da Basílica.",
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
