"use client";

import { useEffect, useRef, useState } from "react";
import { publicAsset } from "./publicAsset";

export function ReservationCountdown({ expiresAt, compact = false, allowNotifications = false, purchaseContext }: { expiresAt: string; compact?: boolean; allowNotifications?: boolean; purchaseContext?: "event" | "outside" }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const urgentNotificationSent = useRef(false);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    urgentNotificationSent.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (!allowNotifications || notificationPermission !== "granted" || remaining <= 0 || remaining > 5 * 60000 || urgentNotificationSent.current) return;
    urgentNotificationSent.current = true;
    new Notification("Sua pré-reserva está perto de expirar", {
      body: "Restam menos de 5 minutos. Confira as orientações da equipe do Arte pela Basílica.",
      icon: publicAsset("/logo-basilica.jpeg"),
      tag: `reserva-${expiresAt}`,
    });
  }, [allowNotifications, expiresAt, notificationPermission, remaining]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    setNotificationPermission(await Notification.requestPermission());
  }

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining > 0 && remaining <= 5 * 60000;
  const expired = remaining === 0;

  return (
    <div className={`reservation-countdown ${compact ? "compact" : ""} ${urgent ? "urgent" : ""} ${expired ? "expired" : ""}`} role={urgent || expired ? "alert" : "timer"} aria-live="polite">
      <span>{expired ? "Pré-reserva expirada" : urgent ? "Atenção: tempo se esgotando" : "Tempo para pagamento presencial"}</span>
      {!expired && <strong>{hours > 0 && `${String(hours).padStart(2, "0")}:`}{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>}
      {!compact && <p>{expired ? "A obra voltou a ficar disponível para outros visitantes." : purchaseContext === "outside" ? "Conclua a compra presencialmente na Basílica Santo Antônio de Pádua, em Americana, antes do fim das 24 horas." : "Conclua o pagamento no Hotel Florença antes do fim dos 30 minutos de bloqueio."}</p>}
      {!compact && allowNotifications && notificationPermission === "default" && <button className="notification-opt-in" type="button" onClick={enableNotifications}>Ativar alerta no celular</button>}
      {!compact && allowNotifications && notificationPermission === "granted" && <small className="notification-enabled">✓ Alerta de 5 minutos ativado neste dispositivo</small>}
      {!compact && allowNotifications && notificationPermission === "denied" && <small className="notification-denied">Notificações bloqueadas nas configurações do navegador.</small>}
    </div>
  );
}
