"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientAudioState {
  isPlaying: boolean;
  volume: number;
  isSupported: boolean;
}

const AMBIENT_AUDIO_URLS = {
  classical: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=classical-ambient-strings-112190.mp3",
  basilica: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_51996d7e16.mp3?filename=basilica-bells-112190.mp3",
  sacred: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_8ab0be4eac.mp3?filename=sacred-organ-112190.mp3",
};

const AUDIO_STORAGE_KEY = "art-basilica-audio-prefs";

interface AudioPreferences {
  isEnabled: boolean;
  volume: number;
  selectedTrack: keyof typeof AMBIENT_AUDIO_URLS;
}

export function useAmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AmbientAudioState>({
    isPlaying: false,
    volume: 0.22,
    isSupported: typeof window !== "undefined" && !!window.AudioContext,
  });
  const [preferences, setPreferences] = useState<AudioPreferences>({
    isEnabled: false,
    volume: 0.22,
    selectedTrack: "classical",
  });

  // Carregar preferências do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AudioPreferences>;
        setPreferences((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignorar erros de parsing
    }
  }, []);

  // Salvar preferências quando mudar
  useEffect(() => {
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage may be unavailable
    }
  }, [preferences]);

  // Inicializar áudio
  useEffect(() => {
    if (!state.isSupported) return;

    if (!audioRef.current) {
      const audio = new Audio(AMBIENT_AUDIO_URLS[preferences.selectedTrack]);
      audio.loop = true;
      audio.volume = preferences.volume;
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current && state.isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [state.isSupported, preferences.selectedTrack]);

  const play = async () => {
    if (!audioRef.current || !state.isSupported) return;

    try {
      // Tentar reproduzir o áudio
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      setState((prev) => ({ ...prev, isPlaying: true }));
      setPreferences((prev) => ({ ...prev, isEnabled: true }));
    } catch (error) {
      console.warn("Falha ao reproduzir áudio ambiente:", error);
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
    setPreferences((prev) => ({ ...prev, isEnabled: false }));
  };

  const toggle = () => {
    if (state.isPlaying) {
      pause();
    } else {
      void play();
    }
  };

  const setVolume = (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    setState((prev) => ({ ...prev, volume: clampedVolume }));
    setPreferences((prev) => ({ ...prev, volume: clampedVolume }));
  };

  const changeTrack = (track: keyof typeof AMBIENT_AUDIO_URLS) => {
    if (audioRef.current) {
      const wasPlaying = state.isPlaying;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      audioRef.current.src = AMBIENT_AUDIO_URLS[track];
      setPreferences((prev) => ({ ...prev, selectedTrack: track }));

      if (wasPlaying) {
        void play();
      }
    }
  };

  return {
    state,
    preferences,
    play,
    pause,
    toggle,
    setVolume,
    changeTrack,
  };
}

interface AmbientAudioButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  className?: string;
}

export function AmbientAudioButton({
  isPlaying,
  onToggle,
  ariaLabel,
  className = "",
}: AmbientAudioButtonProps) {
  return (
    <button
      className={`ambient-audio-button ${isPlaying ? "playing" : ""} ${className}`}
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel || (isPlaying ? "Desligar som ambiente" : "Ligar som ambiente")}
      aria-pressed={isPlaying}
    >
      <span className="audio-icon" aria-hidden="true">
        {isPlaying ? "🔊" : "🔈"}
      </span>
      <span className="audio-label">Som Ambiente</span>
    </button>
  );
}

interface AmbientAudioControlPanelProps {
  state: AmbientAudioState;
  preferences: AudioPreferences;
  onVolumeChange: (volume: number) => void;
  onTrackChange: (track: keyof typeof AMBIENT_AUDIO_URLS) => void;
  onToggle: () => void;
}

export function AmbientAudioControlPanel({
  state,
  preferences,
  onVolumeChange,
  onTrackChange,
  onToggle,
}: AmbientAudioControlPanelProps) {
  return (
    <div className="ambient-audio-panel">
      <div className="audio-panel-header">
        <h3>🎵 Ambientação Sonora</h3>
        <p>Crie uma atmosfera condizente com a basílica</p>
      </div>

      {/* Botão Play/Pause */}
      <div className="audio-control-toggle">
        <button
          className={`audio-play-button ${state.isPlaying ? "active" : ""}`}
          type="button"
          onClick={onToggle}
          aria-pressed={state.isPlaying}
        >
          {state.isPlaying ? (
            <>
              <span className="play-icon">⏸</span>
              Pausar
            </>
          ) : (
            <>
              <span className="play-icon">▶</span>
              Iniciar
            </>
          )}
        </button>
      </div>

      {/* Seletor de Trilha */}
      <div className="audio-track-selector">
        <label htmlFor="track-select">Escolha a trilha sonora:</label>
        <select
          id="track-select"
          value={preferences.selectedTrack}
          onChange={(e) => onTrackChange(e.target.value as keyof typeof AMBIENT_AUDIO_URLS)}
          disabled={state.isPlaying}
        >
          <option value="classical">Música Clássica - Cordas Ambiente</option>
          <option value="basilica">Sinos da Basílica</option>
          <option value="sacred">Órgão Sacro</option>
        </select>
      </div>

      {/* Controle de Volume */}
      <div className="audio-volume-control">
        <label htmlFor="volume-slider">Volume:</label>
        <div className="volume-slider-wrapper">
          <span className="volume-min">🔇</span>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="100"
            value={Math.round(preferences.volume * 100)}
            onChange={(e) => onVolumeChange(parseInt(e.target.value, 10) / 100)}
            className="volume-slider"
            aria-label="Volume do áudio ambiente"
          />
          <span className="volume-max">🔊</span>
        </div>
        <span className="volume-percentage">{Math.round(preferences.volume * 100)}%</span>
      </div>

      {/* Informação de Acessibilidade */}
      <div className="audio-accessibility-note">
        <p>
          <strong>💡 Dica de usabilidade:</strong> O som ambiente é <em>completamente opcional</em>.
          Se preferir navegar sem música, clique no botão de mute a qualquer momento. Respeitamos
          suas preferências de acessibilidade.
        </p>
      </div>

      {/* Status de Suporte */}
      {!state.isSupported && (
        <div className="audio-not-supported" role="alert">
          <p>⚠️ Áudio não é suportado neste navegador.</p>
        </div>
      )}
    </div>
  );
}

export function AmbientAudioVisualizer({
  isPlaying,
  volume,
}: {
  isPlaying: boolean;
  volume: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let time = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Limpar canvas
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(0, 0, width, height);

      // Desenhar ondas de áudio (visualização sutil)
      ctx.strokeStyle = `rgba(183, 144, 75, ${volume * 0.6})`;
      ctx.lineWidth = 2;

      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const baseY = height / 2 + (i - 2) * 15;
        for (let x = 0; x < width; x += 10) {
          const y = baseY + Math.sin((x + time) * 0.05) * 8 * volume;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      time += 0.5;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, volume]);

  return (
    <canvas
      ref={canvasRef}
      className={`audio-visualizer ${isPlaying ? "active" : ""}`}
      width={300}
      height={60}
      aria-hidden="true"
    />
  );
}
