"use client";

import { publicAsset } from "./publicAsset";
import { ADMIN_EMAIL } from "./supabase";

const STATIC_QR = publicAsset("/qr-doacao-pix.png");

export function DonationSection() {
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
          <img src={STATIC_QR} alt="QR Code oficial para doação à Basílica Santo Antônio" />
        </div>
        <div className="pix-ready">
          <span>PIX para doação</span>
          <strong>Escaneie pelo aplicativo do seu banco</strong>
          <p>Aponte a câmera do aplicativo para o QR Code. Antes de concluir, confira se os dados do recebedor correspondem à Basílica Santo Antônio.</p>
          <a className="donation-attention-button" href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Quero contribuir com a Arte pela Basílica")}`}>Falar com a equipe</a>
        </div>
      </div>
    </section>
  );
}
