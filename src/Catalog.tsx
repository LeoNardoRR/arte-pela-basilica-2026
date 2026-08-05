"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const SUPABASE_URL = "https://luodxzttfbnnufxufehb.supabase.co";
const SUPABASE_KEY = "sb_publishable_rmXVP-5JoFt5xTF6humZPQ_oQAWLm2n";
const BASILICA_CREST = `${import.meta.env.BASE_URL}logo-basilica.jpeg`;

const supabaseHeaders = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

type Artwork = { id: number; code: string; title: string; artist: string; technique: string; dimensions: string; status: "available" | "reserved" | "sold"; palette: string };
type CartItem = { work: Artwork; amount: number };

const fallbackWorks: Artwork[] = [
  { id: 1, code: "OB-001", title: "Luz da manhã", artist: "Artista a confirmar", technique: "Óleo sobre tela", dimensions: "80 × 60 cm", status: "available", palette: "sunrise" },
  { id: 2, code: "OB-002", title: "Caminho de fé", artist: "Artista a confirmar", technique: "Técnica mista", dimensions: "70 × 50 cm", status: "available", palette: "navy" },
  { id: 3, code: "OB-003", title: "Santo silêncio", artist: "Artista a confirmar", technique: "Acrílica sobre tela", dimensions: "90 × 70 cm", status: "reserved", palette: "wine" },
  { id: 4, code: "OB-004", title: "Jardim interior", artist: "Artista a confirmar", technique: "Óleo sobre tela", dimensions: "60 × 60 cm", status: "available", palette: "garden" },
  { id: 5, code: "OB-005", title: "Entre arcos", artist: "Artista a confirmar", technique: "Técnica mista", dimensions: "100 × 70 cm", status: "sold", palette: "arches" },
  { id: 6, code: "OB-006", title: "Vigília", artist: "Artista a confirmar", technique: "Acrílica sobre tela", dimensions: "80 × 80 cm", status: "available", palette: "night" },
];

const statusLabel = { available: "Disponível", reserved: "Indisponível", sold: "Adquirida" };
const paymentMethods = [
  { value: "pix", label: "Pix", note: "pagamento à vista" },
  { value: "credit_card", label: "Cartão de crédito", note: "condições com a equipe" },
  { value: "debit_card", label: "Cartão de débito", note: "no atendimento" },
  { value: "bank_transfer", label: "Transferência", note: "dados após aprovação" },
];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function Catalog() {
  const [works, setWorks] = useState<Artwork[]>(fallbackWorks);
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/artworks?select=id,code,title,artist,technique,dimensions,status,palette&order=id.asc`, { headers: supabaseHeaders })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: Artwork[]) => setWorks(data))
      .catch(() => undefined);
    try {
      const saved = localStorage.getItem("arte-pela-basilica-cart");
      if (saved) setCart(JSON.parse(saved) as CartItem[]);
    } catch { /* cart is optional device-local convenience */ }
  }, []);

  useEffect(() => { localStorage.setItem("arte-pela-basilica-cart", JSON.stringify(cart)); }, [cart]);

  const visibleWorks = useMemo(() => filter === "available" ? works.filter((work) => work.status === "available") : filter === "unavailable" ? works.filter((work) => work.status !== "available") : works, [filter, works]);
  const availableCount = works.filter((work) => work.status === "available").length;
  const total = cart.reduce((sum, item) => sum + item.amount, 0);

  function addToCart(work: Artwork) {
    setCart((items) => items.some((item) => item.work.id === work.id) ? items : [...items, { work, amount: 0 }]);
    setMessage("");
    setCartOpen(true);
  }

  function updateAmount(id: number, amount: number) { setCart((items) => items.map((item) => item.work.id === id ? { ...item, amount: Math.max(0, amount) } : item)); }
  function removeFromCart(id: number) { setCart((items) => items.filter((item) => item.work.id !== id)); setMessage(""); }
  function closeCart() { setCartOpen(false); setMessage(""); }

  async function submitBidCart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || cart.some((item) => item.amount <= 0)) { setMessage("Informe um lance para cada obra da sua sacola."); return; }
    setSubmitting(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_auction_cart`, {
        method: "POST", headers: supabaseHeaders,
        body: JSON.stringify({ bidder_name: form.get("name"), bidder_email: form.get("email"), bidder_phone: form.get("phone"), preferred_payment_method: form.get("payment_method"), items: cart.map((item) => ({ artwork_id: item.work.id, amount_cents: Math.round(item.amount * 100) })) }),
      });
      const data = await response.json() as { message?: string } | string;
      if (!response.ok) throw new Error(typeof data === "object" && data?.message ? data.message : "Não foi possível enviar sua proposta.");
      setCart([]);
      setMessage("Proposta enviada. A equipe da Basílica confirmará os lances e orientará o pagamento escolhido.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar sua proposta."); }
    finally { setSubmitting(false); }
  }

  return <main>
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Basílica Santo Antônio — início"><img src={BASILICA_CREST} alt="Brasão da Basílica Santo Antônio" /><span><strong>Basílica</strong><small>Santo Antônio</small></span></a>
      <nav aria-label="Navegação principal"><a href="#evento">O evento</a><a href="#acervo">Obras de arte</a><a href="#como-comprar">Como participar</a><a href="#contato">Fale conosco</a></nav>
      <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir sacola com ${cart.length} obras`}><span>Minha sacola</span><b>{cart.length}</b></button>
    </header>

    <section className="hero" id="inicio"><div className="hero-image" /><div className="hero-overlay" /><div className="hero-content"><p className="eyebrow">Um evento da Basílica Santo Antônio</p><h1>Arte que preserva<br />histórias.</h1><p>Quase 60 obras reunidas em uma noite especial de arte, encontro e contribuição para o futuro da nossa Basílica.</p><div className="hero-actions"><a className="button primary" href="#acervo">Conhecer as obras <span>→</span></a><a className="button ghost" href="#evento">Sobre o evento</a></div></div></section>
    <aside className="event-bar" id="evento"><div className="event-icon" aria-hidden="true">◇</div><div><span>Evento presencial</span><strong>10 de setembro de 2026</strong></div><div><span>Local</span><strong>Hotel anfitrião · detalhes em breve</strong></div><div><span>Acervo online</span><strong>Disponível até 17 de setembro</strong></div><a href="#acervo">Explorar <span>→</span></a></aside>
    <section className="intro"><p className="section-kicker">Arte pela Basílica</p><h2>Uma coleção especial.<br />Um propósito maior.</h2><p className="intro-copy">Selecione as obras que deseja disputar, informe seu lance em cada uma e envie uma única proposta. O total da sua sacola é calculado automaticamente.</p><div className="numbers"><div><strong>~60</strong><span>obras selecionadas</span></div><div><strong>10.09</strong><span>evento no hotel</span></div><div><strong>17.09</strong><span>encerramento online</span></div></div></section>
    <section className="catalog-section" id="acervo"><div className="catalog-heading"><div><p className="section-kicker">Acervo 2026</p><h2>Obras disponíveis</h2><p>{availableCount} de {works.length} obras desta prévia ainda disponíveis.</p></div><div className="filters" aria-label="Filtrar obras"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button><button className={filter === "available" ? "active" : ""} onClick={() => setFilter("available")}>Disponíveis</button><button className={filter === "unavailable" ? "active" : ""} onClick={() => setFilter("unavailable")}>Indisponíveis</button></div></div>
      <div className="works-grid" aria-live="polite">{visibleWorks.map((work) => <article className={`work-card ${work.status !== "available" ? "unavailable" : ""}`} key={work.id}><div className={`work-image ${work.palette}`}><span className={`status ${work.status}`}>{statusLabel[work.status]}</span><div className="art-shape shape-one" /><div className="art-shape shape-two" />{work.status !== "available" && <div className="sold-overlay"><strong>{statusLabel[work.status]}</strong><span>Esta obra não está disponível para proposta.</span></div>}</div><div className="work-body"><span className="work-code">{work.code}</span><h3>{work.title}</h3><p>{work.artist}</p><dl><div><dt>Técnica</dt><dd>{work.technique}</dd></div><div><dt>Dimensões</dt><dd>{work.dimensions}</dd></div><div><dt>Lance</dt><dd>Definido por você</dd></div></dl><button disabled={work.status !== "available"} onClick={() => addToCart(work)}>{cart.some((item) => item.work.id === work.id) ? "Na sua sacola" : "Adicionar à sacola"}<span aria-hidden="true">→</span></button></div></article>)}</div>
    </section>
    <section className="how-section" id="como-comprar"><div><p className="section-kicker light">Como participar</p><h2>Monte a sua proposta.<br />Nós cuidamos do restante.</h2></div><ol><li><span>01</span><div><strong>Selecione</strong><p>Adicione à sacola todas as obras que deseja disputar.</p></div></li><li><span>02</span><div><strong>Informe os lances</strong><p>Defina um valor para cada obra e confira o montante total.</p></div></li><li><span>03</span><div><strong>Escolha como pagar</strong><p>Selecione sua preferência. A confirmação e cobrança são feitas pela equipe.</p></div></li></ol></section>
    <section className="closing" id="contato"><img src={BASILICA_CREST} alt="" /><p className="section-kicker">10 de setembro de 2026</p><h2>Faça parte desta história.</h2><p>Os lances são propostas e não geram cobrança automática. A Basílica entrará em contato para confirmar a disponibilidade e o pagamento.</p><button className="button primary" onClick={() => setCartOpen(true)}>Abrir minha sacola <span>→</span></button></section>
    <footer><div className="brand footer-brand"><img src={BASILICA_CREST} alt="" /><span><strong>Basílica</strong><small>Santo Antônio</small></span></div><p>Arte pela Basílica · Edição 2026</p><p>Acervo online até 17 de setembro de 2026</p></footer>

    {cartOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCart()}><section className="purchase-modal cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title"><button className="modal-close" onClick={closeCart} aria-label="Fechar">×</button><p className="section-kicker">Minha sacola de lances</p><h2 id="cart-title">Sua proposta</h2>{message ? <div className="success-message"><span>✓</span><p>{message}</p><button onClick={closeCart}>Voltar ao acervo</button></div> : cart.length === 0 ? <div className="empty-cart"><p>Adicione obras do acervo para montar sua proposta.</p><a className="button primary" href="#acervo" onClick={closeCart}>Ver obras <span>→</span></a></div> : <form onSubmit={submitBidCart}><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.work.id}><div><strong>{item.work.title}</strong><small>{item.work.code}</small></div><label>Lance (R$)<input type="number" min="1" step="0.01" inputMode="decimal" value={item.amount || ""} onChange={(event) => updateAmount(item.work.id, Number(event.target.value))} required /></label><button type="button" onClick={() => removeFromCart(item.work.id)} aria-label={`Remover ${item.work.title}`}>Remover</button></div>)}</div><div className="cart-total"><span>Montante da proposta</span><strong>{money.format(total)}</strong></div><label>Nome completo<input name="name" required autoComplete="name" /></label><label>E-mail<input name="email" type="email" required autoComplete="email" /></label><label>WhatsApp<input name="phone" type="tel" required autoComplete="tel" /></label><fieldset><legend>Forma de pagamento preferida</legend><div className="payment-options">{paymentMethods.map((method) => <label className="payment-option" key={method.value}><input type="radio" name="payment_method" value={method.value} required /><span><strong>{method.label}</strong><small>{method.note}</small></span></label>)}</div></fieldset><button className="button primary" disabled={submitting}>{submitting ? "Enviando proposta…" : "Enviar proposta"} <span>→</span></button><small>Nenhuma cobrança é feita agora. O pagamento será combinado após a confirmação da Basílica.</small></form>}</section></div>}
  </main>;
}
