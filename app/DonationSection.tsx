"use client";

import { useEffect, useState } from "react";
import { publicAsset } from "./publicAsset";
import { supabase } from "./supabase";

const STATIC_QR = publicAsset("/qr-doacao-pix.png");

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function DonationSection() {
  const [totalCents, setTotalCents] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_total_raised_cents").then(({ data, error }) => {
      if (active && !error && typeof data === "number") setTotalCents(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="donation-section" id="doacao" data-reveal="up">
      <div className="donation-copy">
        <p className="section-kicker">Doação espontânea</p>
        <h2>Um gesto que<br />faz diferença.</h2>
        <p>Além da aquisição das obras, você pode contribuir diretamente com o apoio financeiro à Basílica Santo Antônio.</p>
        <small>A doação é independente da pré-reserva e não substitui o pagamento presencial da obra.</small>
        {totalCents !== null && totalCents > 0 && (
          <p className="donation-total"><span>Arrecadado até agora</span><strong>{money.format(totalCents / 100)}</strong></p>
        )}
      </div>
      <div className="donation-pix-card">
        <div className="qr-code-slot is-ready">
          <img src={STATIC_QR} alt="QR Code oficial para doação à Basílica Santo Antônio" />
        </div>
        <div className="pix-ready">
          <span>PIX para doação</span>
          <strong>Escaneie pelo aplicativo do seu banco</strong>
          <p>Aponte a câmera do aplicativo para o QR Code. Antes de concluir, confira se os dados do recebedor correspondem à Basílica Santo Antônio.</p>
          <a className="donation-attention-button" href="#como-participar">Ver orientações para participar</a>
        </div>
      </div>
    </section>
  );
}
