"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { publicAsset } from "./publicAsset";
import { ADMIN_EMAIL } from "./supabase";

const PIX_KEY = String(import.meta.env.VITE_BASILICA_PIX_KEY ?? "").trim();
const STATIC_QR = publicAsset("/qr-doacao-pix.png");

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function pixPayload(key: string) {
  const merchant = field("00", "br.gov.bcb.pix") + field("01", key);
  const body = field("00", "01") + field("26", merchant) + field("52", "0000") + field("53", "986") + field("58", "BR") + field("59", "BASILICA SANTO ANTONIO") + field("60", "AMERICANA") + field("62", field("05", "***")) + "6304";
  return body + crc16(body);
}

export function DonationSection() {
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!PIX_KEY) return;
    QRCode.toDataURL(pixPayload(PIX_KEY), { width: 320, margin: 2, color: { dark: "#000666", light: "#ffffff" } }).then(setQrUrl).catch(() => setQrUrl(""));
  }, []);

  async function copyKey() {
    if (!PIX_KEY) return;
    await navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="donation-section" id="doacao" data-reveal="up">
      <div className="donation-copy">
        <p className="section-kicker">Doação espontânea</p>
        <h2>Um gesto que<br />faz diferença.</h2>
        <p>Além da aquisição das obras, você pode contribuir diretamente com o apoio financeiro à Basílica Santo Antônio.</p>
        <small>A doação é independente da pré-reserva e não substitui o pagamento presencial da obra.</small>
      </div>
      <div className="donation-pix-card">
        <div className="qr-code-slot is-ready">
          <img src={qrUrl || STATIC_QR} alt="QR Code PIX para doação à Basílica Santo Antônio" />
        </div>
        {PIX_KEY && qrUrl ? (
          <div><span>PIX para doação</span><strong>Escaneie pelo aplicativo do seu banco</strong><button className="donation-attention-button" type="button" onClick={copyKey}>{copied ? "Chave copiada" : "Copiar chave PIX"}</button></div>
        ) : (
          <div className="pix-pending"><span>PIX para doação</span><strong>Escaneie pelo aplicativo do seu banco</strong><p>Aponte a câmera do app do seu banco para o QR Code e confirme a doação. Qualquer valor ajuda a Basílica Santo Antônio.</p><a className="donation-attention-button" href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Quero contribuir com a Arte pela Basílica")}`}>Falar com a equipe</a></div>
        )}
      </div>
    </section>
  );
}
