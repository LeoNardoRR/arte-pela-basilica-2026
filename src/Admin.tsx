import { useEffect, useState } from "react";

const SUPABASE_URL = "https://luodxzttfbnnufxufehb.supabase.co";
const SUPABASE_KEY = "sb_publishable_rmXVP-5JoFt5xTF6humZPQ_oQAWLm2n";
const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
const BASILICA_CREST = "/logo-basilica.jpeg";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const paymentLabel: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência",
  in_person: "Presencial",
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "Aguardando",  color: "#714b0a", bg: "#fff1cb" },
  reviewed:  { label: "Em análise",  color: "#1a3a6e", bg: "#e0e8ff" },
  approved:  { label: "Aceita ✓",   color: "#24612b", bg: "#dfeadd" },
  declined:  { label: "Recusada",    color: "#7b1f33", bg: "#fde0e6" },
  paid:      { label: "Paga",        color: "#1b5e20", bg: "#c8e6c9" },
};

type CartItem = { artwork_id: number; artwork_code: string; artwork_title: string; amount_cents: number };
type Cart = {
  id: string;
  bidder_name: string;
  bidder_email: string;
  bidder_phone: string;
  preferred_payment_method: string;
  total_cents: number;
  status: string;
  created_at: string;
  items: CartItem[];
};

type Bid = {
  cart_id: string;
  bidder_name: string;
  bidder_email: string;
  bidder_phone: string;
  preferred_payment_method: string;
  status: string;
  created_at: string;
  amount_cents: number;
};

type ArtworkGroup = {
  artwork_id: number;
  artwork_code: string;
  artwork_title: string;
  bids: Bid[];
};

function groupByArtwork(carts: Cart[]): ArtworkGroup[] {
  const map = new Map<number, ArtworkGroup>();
  for (const cart of carts) {
    for (const item of cart.items) {
      if (!map.has(item.artwork_id)) {
        map.set(item.artwork_id, {
          artwork_id: item.artwork_id,
          artwork_code: item.artwork_code,
          artwork_title: item.artwork_title,
          bids: [],
        });
      }
      map.get(item.artwork_id)!.bids.push({
        cart_id: cart.id,
        bidder_name: cart.bidder_name,
        bidder_email: cart.bidder_email,
        bidder_phone: cart.bidder_phone,
        preferred_payment_method: cart.preferred_payment_method,
        status: cart.status,
        created_at: cart.created_at,
        amount_cents: item.amount_cents,
      });
    }
  }
  const groups = Array.from(map.values());
  for (const group of groups) {
    const uniqueBids = new Map<string, Bid>();
    for (const bid of group.bids) {
      const key = bid.bidder_email.toLowerCase();
      const existing = uniqueBids.get(key);
      if (!existing) {
        uniqueBids.set(key, bid);
      } else {
        if (existing.status === "approved") continue;
        if (bid.status === "approved" || bid.amount_cents > existing.amount_cents) {
          uniqueBids.set(key, bid);
        }
      }
    }
    group.bids = Array.from(uniqueBids.values());
    group.bids.sort((a, b) => b.amount_cents - a.amount_cents); // highest bid first
  }
  return groups;
}

export default function Admin({ onBack }: { onBack: () => void }) {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [password, setPassword]   = useState("");
  const [loginError, setLoginError] = useState("");

  const [carts, setCarts]         = useState<Cart[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup]   = useState<number | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  function loadProposals() {
    setLoading(true);
    fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_get_proposals`, {
      method: "POST", headers, body: "{}",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? `Erro ${res.status}`);
        setCarts(data as Cart[]);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { 
    if (loggedIn) {
      loadProposals();
    }
  }, [loggedIn]);

  async function approveCart(cartId: string) {
    setApproving(cartId);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_approve_cart`, {
        method: "POST", headers,
        body: JSON.stringify({ cart_id: cartId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message ?? "Erro ao aprovar");
      }
      setCarts((prev) =>
        prev.map((c) => c.id === cartId ? { ...c, status: "approved" } : c)
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao aprovar proposta.");
    } finally {
      setApproving(null);
    }
  }

  if (!loggedIn) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--navy)" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "14px", width: "min(400px, 90vw)", textAlign: "center", boxShadow: "0 25px 80px rgba(0,0,0,.3)" }}>
          <img src={BASILICA_CREST} alt="" style={{ width: 60, height: 60, borderRadius: 8, marginBottom: 20 }} />
          <h2 style={{ margin: "0 0 20px", color: "var(--navy)", font: '700 24px "Playfair Display", serif' }}>Acesso Restrito</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (password === "admin123") setLoggedIn(true);
            else setLoginError("Senha incorreta (dica: admin123)");
          }}>
            <input 
              type="password" 
              placeholder="Senha de acesso" 
              value={password}
              onChange={e => { setPassword(e.target.value); setLoginError(""); }}
              style={{ width: "100%", padding: "14px", border: "1px solid var(--line)", borderRadius: "8px", marginBottom: "10px", outline: "none" }}
            />
            {loginError && <p style={{ color: "var(--wine)", fontSize: "12px", margin: "0 0 10px", textAlign: "left" }}>{loginError}</p>}
            <button type="submit" style={{ width: "100%", padding: "14px", background: "var(--navy-2)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", textTransform: "uppercase", cursor: "pointer" }}>Entrar no Painel</button>
          </form>
          <button onClick={onBack} style={{ marginTop: "24px", background: "transparent", border: 0, color: "var(--muted)", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>Voltar ao catálogo</button>
        </div>
      </main>
    );
  }

  const groups = groupByArtwork(carts);
  const totalArrecadado = carts.filter(c => c.status === "approved").reduce((s, c) => s + c.total_cents, 0);
  const totalPendentes  = carts.filter(c => c.status === "submitted").length;

  return (
    <main>
      {/* ── Header ── */}
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Basílica Santo Antônio — início">
          <img src={BASILICA_CREST} alt="Brasão da Basílica Santo Antônio" />
          <span><strong>Basílica</strong><small>Santo Antônio</small></span>
        </a>
        <nav aria-label="Navegação administrativa">
          <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Catálogo</a>
        </nav>
        <span style={{
          background: "var(--gold)", color: "white", borderRadius: "20px",
          padding: "6px 14px", fontSize: "9px", fontWeight: 700,
          letterSpacing: ".1em", textTransform: "uppercase",
        }}>Painel Admin</span>
      </header>

      {/* ── Hero ── */}
      <section style={{
        background: "var(--navy)", color: "white",
        padding: "60px max(5vw, calc((100vw - 1180px) / 2)) 50px",
      }}>
        <p className="section-kicker light">Painel de controle</p>
        <h1 style={{ margin: "0 0 8px", font: '700 clamp(38px,4vw,52px)/1.1 "Playfair Display", serif', letterSpacing: "-.02em" }}>
          Propostas por Obra
        </h1>
        <p style={{ margin: "16px 0 40px", color: "rgba(255,255,255,.65)", fontSize: "15px", maxWidth: "600px", lineHeight: 1.7 }}>
          Compare as propostas enviadas para cada obra. Ao aceitar um lance, a obra é marcada como <strong>Adquirida</strong> no catálogo automaticamente.
        </p>

        {!loading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", maxWidth: "800px" }}>
            {[
              { label: "Obras disputadas",  value: String(groups.length) },
              { label: "Total de lances",   value: String(carts.length) },
              { label: "Propostas pend.",   value: String(totalPendentes) },
              { label: "Arrecadado",        value: money.format(totalArrecadado / 100) },
            ].map((c) => (
              <div key={c.label} style={{
                background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)",
                borderRadius: "13px", padding: "18px 20px",
              }}>
                <strong style={{ display: "block", font: '700 26px "Playfair Display", serif', color: "var(--gold)" }}>
                  {c.value}
                </strong>
                <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.55)", marginTop: "6px", display: "block" }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Lista de grupos ── */}
      <section id="propostas" style={{ padding: "60px max(5vw, calc((100vw - 1180px) / 2))", background: "#f0ece8", minHeight: "50vh" }}>

        {loading && <p style={{ color: "var(--muted)", textAlign: "center", padding: "60px 0" }}>Carregando propostas…</p>}

        {error && (
          <div style={{ background: "white", borderRadius: "14px", padding: "32px", border: "1px solid var(--line)", textAlign: "center" }}>
            <p style={{ color: "var(--wine)", fontWeight: 600 }}>Erro ao carregar</p>
            <p style={{ color: "var(--muted)", fontSize: "13px" }}>{error}</p>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div style={{ background: "white", borderRadius: "14px", padding: "52px 32px", textAlign: "center", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>📋</div>
            <p style={{ color: "var(--navy)", fontWeight: 700, fontSize: "20px", margin: "0 0 8px" }}>Nenhuma proposta ainda</p>
            <p style={{ color: "var(--muted)", fontSize: "13px" }}>As propostas enviadas aparecerão aqui automaticamente.</p>
          </div>
        )}

        {!loading && !error && groups.map((group) => {
          const isGroupOpen = expandedGroup === group.artwork_id;
          const hasApproved = group.bids.some(b => b.status === "approved");
          const highestBid = group.bids[0]?.amount_cents || 0;

          return (
            <div key={group.artwork_id} style={{ marginBottom: "20px" }}>
              {/* Cabeçalho do grupo (por obra) */}
              <button
                onClick={() => setExpandedGroup(isGroupOpen ? null : group.artwork_id)}
                style={{
                  width: "100%", display: "grid",
                  gridTemplateColumns: "1fr auto auto 32px",
                  alignItems: "center", gap: "20px",
                  padding: "20px 26px",
                  background: hasApproved ? "#f0f7f0" : "white",
                  border: `1px solid ${hasApproved ? "#b2d8b2" : "var(--line)"}`,
                  borderRadius: isGroupOpen ? "14px 14px 0 0" : "14px",
                  cursor: "pointer", textAlign: "left",
                  boxShadow: "0 4px 22px rgba(20,20,30,.06)",
                }}
              >
                <div>
                  <strong style={{ font: '700 20px "Playfair Display", serif', color: "var(--navy)", display: "block" }}>
                    {group.artwork_title}
                  </strong>
                  <span style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 700, letterSpacing: ".1em", display: "block", marginTop: "3px" }}>
                    {group.artwork_code}
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)", display: "block" }}>Lances</span>
                  <strong style={{ fontSize: "15px", color: "var(--navy)" }}>{group.bids.length}</strong>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)", display: "block" }}>Maior lance</span>
                  <strong style={{ font: '700 18px "Playfair Display", serif', color: "var(--gold)" }}>
                    {money.format(highestBid / 100)}
                  </strong>
                </div>

                <span style={{
                  fontSize: "20px", color: "var(--muted)",
                  transform: isGroupOpen ? "rotate(90deg)" : "rotate(0)",
                  transition: "transform .2s",
                }}>›</span>
              </button>

              {/* Lances para a obra */}
              {isGroupOpen && (
                <div style={{
                  border: "1px solid var(--line)", borderTop: "none",
                  borderRadius: "0 0 14px 14px", overflow: "hidden",
                  background: "white",
                }}>
                  {group.bids.map((bid, idx) => {
                    const st = statusConfig[bid.status] ?? { label: bid.status, color: "#333", bg: "#eee" };
                    const isApproving = approving === bid.cart_id;
                    const alreadyApproved = bid.status === "approved";

                    return (
                      <div key={bid.cart_id} style={{
                        borderTop: idx > 0 ? "1px solid var(--line)" : undefined,
                        display: "grid",
                        gridTemplateColumns: "1fr 160px 170px auto",
                        alignItems: "center", gap: "16px",
                        padding: "16px 26px",
                        background: alreadyApproved ? "#f7fbf7" : "transparent"
                      }}>
                        {/* Info do proponente */}
                        <div>
                          <strong style={{ fontSize: "15px", color: "var(--navy)", display: "block" }}>
                            {bid.bidder_name}
                          </strong>
                          <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                            {bid.bidder_email} · {bid.bidder_phone}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                            {new Date(bid.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                            &nbsp;·&nbsp;{paymentLabel[bid.preferred_payment_method] ?? bid.preferred_payment_method}
                          </span>
                        </div>

                        {/* Status */}
                        <div>
                          <span style={{
                            display: "inline-block",
                            background: st.bg, color: st.color,
                            borderRadius: "20px", padding: "4px 12px",
                            fontSize: "9px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
                          }}>{st.label}</span>
                        </div>

                        {/* Valor do Lance */}
                        <strong style={{ font: '700 20px "Playfair Display", serif', color: "var(--gold)" }}>
                          {money.format(bid.amount_cents / 100)}
                        </strong>

                        {/* Botão aceitar */}
                        <button
                          onClick={() => !alreadyApproved && !hasApproved && approveCart(bid.cart_id)}
                          disabled={alreadyApproved || hasApproved || isApproving}
                          style={{
                            border: 0, borderRadius: "9px",
                            padding: "10px 16px",
                            background: alreadyApproved ? "#dfeadd" : hasApproved ? "#f0ece8" : "var(--navy-2)",
                            color: alreadyApproved ? "#24612b" : hasApproved ? "#a59d95" : "white",
                            fontSize: "10px", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: ".06em",
                            cursor: alreadyApproved || hasApproved ? "default" : "pointer",
                            whiteSpace: "nowrap",
                            opacity: isApproving ? 0.7 : 1,
                          }}
                        >
                          {isApproving ? "Aprovando…" : alreadyApproved ? "✓ Aceita" : hasApproved ? "Outra aceita" : "Aceitar lance →"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <footer>
        <div className="brand footer-brand">
          <img src={BASILICA_CREST} alt="" />
          <span><strong>Basílica</strong><small>Santo Antônio</small></span>
        </div>
        <p>Arte pela Basílica · Edição 2026</p>
        <p>Painel administrativo</p>
      </footer>
    </main>
  );
}
