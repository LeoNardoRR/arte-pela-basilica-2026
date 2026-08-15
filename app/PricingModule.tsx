"use client";

import { useState, useRef, useEffect } from "react";

interface PricingOption {
  id: string;
  label: string;
  type: "base" | "upsell" | "donation";
  amount: number;
  description?: string;
  isActive: boolean;
}

interface FlexiblePrice {
  basePrice: number;
  selectedUpsells: string[];
  donationAmount: number;
  total: number;
}

interface PricingModuleProps {
  basePrice: number;
  workId: number;
  workTitle: string;
  onPricingChange: (pricing: FlexiblePrice) => void;
}

const DEFAULT_UPSELL_OPTIONS: PricingOption[] = [
  {
    id: "upsell-frame-upgrade",
    label: "Moldura Premium",
    type: "upsell",
    amount: 150 * 100, // R$ 150.00 em centavos
    description: "Upgrade para moldura em ouro 24k",
    isActive: true,
  },
  {
    id: "upsell-certificate",
    label: "Certificado Assinado",
    type: "upsell",
    amount: 75 * 100,
    description: "Certificado de autenticidade manuscrito",
    isActive: true,
  },
  {
    id: "upsell-insurance",
    label: "Seguro de Transporte",
    type: "upsell",
    amount: 100 * 100,
    description: "Seguro para transporte e entrega",
    isActive: true,
  },
];

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatPrice(cents: number) {
  return money.format(cents / 100);
}

export function useFlexiblePricing(basePrice: number) {
  const [pricing, setPricing] = useState<FlexiblePrice>({
    basePrice,
    selectedUpsells: [],
    donationAmount: 0,
    total: basePrice,
  });

  const updateUpsells = (upsellIds: string[], upsellOptions: PricingOption[]) => {
    const upsellTotal = upsellIds.reduce((sum, id) => {
      const option = upsellOptions.find((opt) => opt.id === id);
      return sum + (option?.amount ?? 0);
    }, 0);

    setPricing((prev) => ({
      ...prev,
      selectedUpsells: upsellIds,
      total: prev.basePrice + upsellTotal + prev.donationAmount,
    }));
  };

  const updateDonation = (amount: number) => {
    const upsellTotal = pricing.selectedUpsells.reduce((sum, id) => {
      const option = DEFAULT_UPSELL_OPTIONS.find((opt) => opt.id === id);
      return sum + (option?.amount ?? 0);
    }, 0);

    setPricing((prev) => ({
      ...prev,
      donationAmount: amount,
      total: prev.basePrice + upsellTotal + amount,
    }));
  };

  return { pricing, updateUpsells, updateDonation };
}

export function PricingModule({
  basePrice,
  workId,
  workTitle,
  onPricingChange,
}: PricingModuleProps) {
  const { pricing, updateUpsells, updateDonation } = useFlexiblePricing(basePrice);
  const [expandedUpsells, setExpandedUpsells] = useState(false);
  const [customDonation, setCustomDonation] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPricingChange(pricing);
  }, [pricing, onPricingChange]);

  const toggleUpsell = (upsellId: string) => {
    const newSelection = pricing.selectedUpsells.includes(upsellId)
      ? pricing.selectedUpsells.filter((id) => id !== upsellId)
      : [...pricing.selectedUpsells, upsellId];
    updateUpsells(newSelection, DEFAULT_UPSELL_OPTIONS);
  };

  const handleDonationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setCustomDonation(value);
    const amountCents = parseInt(value, 10) * 100 || 0;
    updateDonation(amountCents);
  };

  const generateQRCodeData = (): string => {
    // Simular dados para QR Code (PIX, por exemplo)
    // Em produção, você geraria um QR Code real via API Supabase
    const pixKey = "chave-pix-basilica@banco.com";
    const description = `Doação - ${workTitle}`;
    const amount = (pricing.donationAmount / 100).toFixed(2);
    return `00020126580014br.gov.bcb.pix0136${pixKey}520400005303986540510.${amount}5802BR5913BASILICA6009SAO PAULO62410503***63047B5D`;
  };

  const upsellTotal = pricing.selectedUpsells.reduce((sum, id) => {
    const option = DEFAULT_UPSELL_OPTIONS.find((opt) => opt.id === id);
    return sum + (option?.amount ?? 0);
  }, 0);

  return (
    <div className="pricing-module">
      <div className="pricing-section pricing-base">
        <div className="pricing-header">
          <h3>Valor Base</h3>
          <span className="base-price">{formatPrice(basePrice)}</span>
        </div>
        <p className="pricing-description">Preço da obra</p>
      </div>

      {/* UPSELL - Personalização de Valores */}
      <div className="pricing-section pricing-upsells">
        <button
          className="pricing-expandable"
          type="button"
          onClick={() => setExpandedUpsells(!expandedUpsells)}
          aria-expanded={expandedUpsells}
        >
          <span className="section-icon">💎</span>
          <div className="section-label">
            <strong>Potencialize sua experiência</strong>
            <small>Adicione serviços especiais (opcional)</small>
          </div>
          <span className="expand-icon">{expandedUpsells ? "−" : "+"}</span>
        </button>

        {expandedUpsells && (
          <div className="upsell-options">
            {DEFAULT_UPSELL_OPTIONS.map((option) => {
              const isSelected = pricing.selectedUpsells.includes(option.id);
              return (
                <label key={option.id} className={`upsell-option ${isSelected ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUpsell(option.id)}
                    aria-label={`${option.label} - ${formatPrice(option.amount)}`}
                  />
                  <div className="upsell-content">
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                    <span className="upsell-price">+{formatPrice(option.amount)}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {upsellTotal > 0 && (
          <div className="upsell-total">
            <span>Subtotal (serviços adicionais)</span>
            <strong>{formatPrice(upsellTotal)}</strong>
          </div>
        )}
      </div>

      {/* DONATION - PIX QR CODE */}
      <div className="pricing-section pricing-donation">
        <button
          className="pricing-expandable"
          type="button"
          onClick={() => setShowQRCode(!showQRCode)}
          aria-expanded={showQRCode}
        >
          <span className="section-icon">🤝</span>
          <div className="section-label">
            <strong>Fazer uma doação</strong>
            <small>Contribua para a preservação do patrimônio sacro (opcional)</small>
          </div>
          <span className="expand-icon">{showQRCode ? "−" : "+"}</span>
        </button>

        {showQRCode && (
          <div className="donation-content">
            <div className="donation-input-group">
              <label htmlFor={`donation-${workId}`}>Valor da doação (opcional):</label>
              <div className="input-with-currency">
                <span className="currency-symbol">R$</span>
                <input
                  id={`donation-${workId}`}
                  type="text"
                  placeholder="0"
                  value={customDonation}
                  onChange={handleDonationChange}
                  maxLength="8"
                  aria-label="Valor de doação em reais"
                />
              </div>
            </div>

            {pricing.donationAmount > 0 && (
              <div className="qr-code-container" ref={qrCodeRef}>
                <div className="qr-placeholder">
                  {/* Aqui você colocaria um componente real de QR Code */}
                  {/* Por enquanto, mostramos um placeholder */}
                  <div className="qr-mock">
                    <svg viewBox="0 0 29 29" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0,0 L9,0 L9,9 L0,9 Z M1,1 L8,1 L8,8 L1,8 Z M2,2 L7,2 L7,7 L2,7 Z" fill="black" />
                      <path d="M20,0 L29,0 L29,9 L20,9 Z M21,1 L28,1 L28,8 L21,8 Z M22,2 L27,2 L27,7 L22,7 Z" fill="black" />
                      <path d="M0,20 L9,20 L9,29 L0,29 Z M1,21 L8,21 L8,28 L1,28 Z M2,22 L7,22 L7,27 L2,27 Z" fill="black" />
                      <rect x="11" y="11" width="7" height="7" fill="black" />
                    </svg>
                  </div>
                  <p className="qr-label">PIX - Leia o código</p>
                  <small>{formatPrice(pricing.donationAmount)}</small>
                </div>
                <div className="qr-info">
                  <p>
                    <strong>Chave PIX:</strong> <code>chave-pix-basilica@banco.com</code>
                  </p>
                  <p className="donation-note">
                    Sua doação contribui diretamente para a preservação do patrimônio sacro da
                    Basílica Santo Antônio.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RESUMO FINAL */}
      <div className="pricing-summary">
        <div className="summary-line">
          <span>Valor base</span>
          <strong>{formatPrice(basePrice)}</strong>
        </div>
        {upsellTotal > 0 && (
          <div className="summary-line">
            <span>Serviços adicionais</span>
            <strong>+{formatPrice(upsellTotal)}</strong>
          </div>
        )}
        {pricing.donationAmount > 0 && (
          <div className="summary-line">
            <span>Doação</span>
            <strong>+{formatPrice(pricing.donationAmount)}</strong>
          </div>
        )}
        <div className="summary-total">
          <span>Total</span>
          <strong>{formatPrice(pricing.total)}</strong>
        </div>
      </div>
    </div>
  );
}

export function DonationQRCodeModal({
  amount,
  workTitle,
  onClose,
}: {
  amount: number;
  workTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="donation-modal">
        <button className="close-button" onClick={onClose} type="button" aria-label="Fechar">
          ✕
        </button>
        <div className="modal-content">
          <h2>Doação PIX</h2>
          <p>
            Doação para <strong>{workTitle}</strong>
          </p>
          <div className="qr-display">
            {/* QR Code real seria gerado aqui */}
            <div className="qr-placeholder" />
            <p>{formatPrice(amount)}</p>
          </div>
          <div className="pix-details">
            <p>
              <strong>Chave PIX:</strong>
            </p>
            <code>chave-pix-basilica@banco.com</code>
          </div>
        </div>
      </section>
    </div>
  );
}
