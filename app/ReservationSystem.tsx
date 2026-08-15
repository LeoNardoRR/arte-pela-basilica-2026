"use client";

import { useEffect, useState, useRef } from "react";

type ReservationState = "idle" | "active" | "expiring" | "expired";

interface Reservation {
  workId: number;
  expiresAt: number;
  state: ReservationState;
}

interface ReservationTimerProps {
  workId: number;
  reservationDurationMs: number;
  isReserved: boolean;
  onReservation: (reserved: boolean) => void;
  onExpiry: () => void;
}

const DEFAULT_RESERVATION_DURATION = 5 * 60 * 1000; // 5 minutos

export function useReservationSystem() {
  const [reservations, setReservations] = useState<Map<number, Reservation>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar com localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("art-reservations");
      if (saved) {
        const parsed = JSON.parse(saved) as Array<[number, Reservation]>;
        const map = new Map(parsed);
        // Limpar reservas expiradas
        const now = Date.now();
        map.forEach((res, id) => {
          if (res.expiresAt < now) {
            map.delete(id);
          }
        });
        setReservations(map);
      }
    } catch {
      // Ignorar erros de parsing
    }
  }, []);

  // Atualizar localStorage e estados sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem("art-reservations", JSON.stringify(Array.from(reservations.entries())));
    } catch {
      // Storage may be unavailable
    }
  }, [reservations]);

  // Timer para verificar expiração e atualizar UI
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setReservations((prev) => {
        let changed = false;
        const next = new Map(prev);
        const toDelete: number[] = [];

        next.forEach((res, id) => {
          const timeLeft = res.expiresAt - now;
          let newState: ReservationState = res.state;

          if (timeLeft <= 0) {
            newState = "expired";
            toDelete.push(id);
            changed = true;
          } else if (timeLeft <= 30000) { // Últimos 30 segundos
            newState = "expiring";
            if (res.state !== "expiring") changed = true;
          }

          if (newState !== res.state) {
            next.set(id, { ...res, state: newState });
          }
        });

        toDelete.forEach((id) => next.delete(id));
        return changed ? next : prev;
      });
    };

    timerRef.current = setInterval(update, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const reserve = (workId: number, durationMs = DEFAULT_RESERVATION_DURATION) => {
    setReservations((prev) => {
      const next = new Map(prev);
      next.set(workId, {
        workId,
        expiresAt: Date.now() + durationMs,
        state: "active",
      });
      return next;
    });
  };

  const cancel = (workId: number) => {
    setReservations((prev) => {
      const next = new Map(prev);
      next.delete(workId);
      return next;
    });
  };

  const getReservation = (workId: number) => reservations.get(workId) ?? null;
  const isReserved = (workId: number) => reservations.has(workId);

  return { reserve, cancel, getReservation, isReserved, reservations };
}

export function ReservationTimer({
  workId,
  reservationDurationMs = DEFAULT_RESERVATION_DURATION,
  isReserved,
  onReservation,
  onExpiry,
}: ReservationTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [state, setState] = useState<ReservationState>("idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const expiryRef = useRef<number>(0);

  useEffect(() => {
    if (!isReserved) {
      setState("idle");
      setTimeLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (state === "idle") {
      expiryRef.current = Date.now() + reservationDurationMs;
      setState("active");
      onReservation(true);
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, expiryRef.current - now);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setState("expired");
        if (timerRef.current) clearInterval(timerRef.current);
        onExpiry();
      } else if (remaining <= 30000 && state !== "expiring") {
        setState("expiring");
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isReserved, reservationDurationMs, state, onReservation, onExpiry]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const timeLeftFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isExpiring = state === "expiring";
  const isExpired = state === "expired";

  return (
    <div className={`reservation-timer timer-${state}`} data-expiring={isExpiring} data-expired={isExpired}>
      <div className={`timer-display ${isExpiring ? "pulse" : ""}`}>
        <span className="timer-label">Pré-reserva temporizada</span>
        <strong className="timer-value">{timeLeftFormatted}</strong>
      </div>

      {isExpiring && (
        <div className="timer-alert" role="alert">
          ⚠️ Sua pré-reserva vence em breve!
        </div>
      )}

      {isExpired && (
        <div className="timer-expired" role="alert">
          ⏱️ Pré-reserva expirada. Quadro desbloqueado.
        </div>
      )}

      <div className="timer-instructions">
        <p>
          <strong>Instruções de pagamento presencial:</strong> <br />
          Você tem{" "}
          <strong>
            {minutes} minutos
          </strong>{" "}
          para se dirigir presencialmente à Basílica Santo Antônio e efetivar o pagamento.
        </p>
        <p>
          <em>Após esse período, o quadro será automaticamente desbloqueado para outros
          interessados.</em>
        </p>
      </div>
    </div>
  );
}

export function PreReservationButton({
  workId,
  workTitle,
  isReserved,
  onReserve,
  onCancel,
  disabled = false,
}: {
  workId: number;
  workTitle: string;
  isReserved: boolean;
  onReserve: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`button-pre-reserve ${isReserved ? "reserved" : ""}`}
      type="button"
      onClick={() => (isReserved ? onCancel() : onReserve())}
      disabled={disabled}
      aria-label={
        isReserved
          ? `Cancelar pré-reserva de ${workTitle}`
          : `Fazer pré-reserva de ${workTitle}`
      }
    >
      {isReserved ? (
        <>
          <span className="reserve-icon">✓</span>
          Pré-reservado
        </>
      ) : (
        <>
          <span className="reserve-icon">📅</span>
          Pré-reservar (5 min)
        </>
      )}
    </button>
  );
}
