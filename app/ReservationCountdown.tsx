"use client";

import { useEffect, useState } from "react";

export function ReservationCountdown({ expiresAt, compact = false }: { expiresAt: string; compact?: boolean }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining > 0 && remaining <= 5 * 60000;
  const expired = remaining === 0;

  return (
    <div className={`reservation-countdown ${compact ? "compact" : ""} ${urgent ? "urgent" : ""} ${expired ? "expired" : ""}`} role={urgent || expired ? "alert" : "timer"} aria-live="polite">
      <span>{expired ? "Pré-reserva expirada" : urgent ? "Atenção: tempo se esgotando" : "Tempo para pagamento presencial"}</span>
      {!expired && <strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>}
      {!compact && <p>{expired ? "A obra voltou a ficar disponível para outros visitantes." : "Dirija-se à Basílica Santo Antônio, na R. Vieira Bueno, 150, antes do fim do prazo para confirmar a compra e efetuar o pagamento."}</p>}
    </div>
  );
}
