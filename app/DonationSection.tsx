"use client";

import { publicAsset } from "./publicAsset";

const DONATION_QR_CODE = publicAsset("/qr-code-doacao-patrimonio.png");

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
          <img src={DONATION_QR_CODE} alt="QR Code oficial para doação à Basílica Santo Antônio" />
        </div>
        <div className="pix-ready">
          <span>PIX para doação</span>
          <strong>Escaneie pelo aplicativo do seu banco</strong>
          <p>Antes de concluir, confira no aplicativo se os dados do recebedor correspondem à Basílica Santo Antônio.</p>
        </div>
      </div>
    </section>
  );
}
