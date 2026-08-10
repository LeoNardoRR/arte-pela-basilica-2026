"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_EMAIL, supabase } from "./supabase";

const BASILICA_CREST = "/logo-basilica.jpeg";
const CART_STORAGE_KEY = "arte-pela-basilica-cart";
const MAX_BID = 1_000_000;

type Artwork = {
  id: number;
  code: string;
  title: string;
  artist: string;
  technique: string;
  dimensions: string;
  status: "available" | "reserved" | "sold";
  palette: string;
};

type CartItem = { work: Artwork; amount: number };
type CatalogFilter = "all" | "available" | "unavailable";

const statusLabel = {
  available: "Disponível",
  reserved: "Indisponível",
  sold: "Adquirida",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function loadSavedCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as CartItem;
      return Number.isInteger(candidate.work?.id) && Number.isFinite(candidate.amount) && candidate.amount >= 0;
    });
  } catch {
    return [];
  }
}

export function Catalog() {
  const [works, setWorks] = useState<Artwork[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [cart, setCart] = useState<CartItem[]>(loadSavedCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [emailUrl, setEmailUrl] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError("");
    const { data, error } = await supabase
      .from("artworks")
      .select("id,code,title,artist,technique,dimensions,status,palette")
      .order("id", { ascending: true });

    if (error) {
      setCatalogError("Não foi possível carregar o acervo agora. Tente novamente em alguns instantes.");
      setWorks([]);
    } else {
      const freshWorks = (data ?? []) as Artwork[];
      setWorks(freshWorks);
      setCart((items) => items.flatMap((item) => {
        const currentWork = freshWorks.find((work) => work.id === item.work.id);
        return currentWork?.status === "available" ? [{ ...item, work: currentWork }] : [];
      }));
    }
    setCatalogLoading(false);
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The cart remains usable in memory when browser storage is unavailable.
    }
  }, [cart]);

  useEffect(() => {
    if (!cartOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cartOpen]);

  const visibleWorks = useMemo(() => {
    if (filter === "available") return works.filter((work) => work.status === "available");
    if (filter === "unavailable") return works.filter((work) => work.status !== "available");
    return works;
  }, [filter, works]);

  const availableCount = works.filter((work) => work.status === "available").length;
  const total = cart.reduce((sum, item) => sum + item.amount, 0);

  function carouselStep() {
    const carousel = carouselRef.current;
    const firstCard = carousel?.querySelector<HTMLElement>(".work-card");
    if (!carousel || !firstCard) return 0;
    const gap = Number.parseFloat(window.getComputedStyle(carousel).columnGap || "0");
    return firstCard.offsetWidth + gap;
  }

  function moveCarousel(direction: -1 | 1) {
    const step = carouselStep();
    carouselRef.current?.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function syncCarouselIndex() {
    const carousel = carouselRef.current;
    const step = carouselStep();
    if (!carousel || !step) return;
    setCarouselIndex(Math.round(carousel.scrollLeft / step));
  }

  function changeFilter(nextFilter: CatalogFilter) {
    setFilter(nextFilter);
    setCarouselIndex(0);
    carouselRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }

  function addToCart(work: Artwork) {
    setCart((items) => items.some((item) => item.work.id === work.id)
      ? items
      : [...items, { work, amount: 0 }]);
    setMessage("");
    setEmailUrl("");
    setCartOpen(true);
  }

  function updateAmount(id: number, amount: number) {
    const safeAmount = Number.isFinite(amount) ? Math.min(MAX_BID, Math.max(0, amount)) : 0;
    setCart((items) => items.map((item) => item.work.id === id ? { ...item, amount: safeAmount } : item));
  }

  function removeFromCart(id: number) {
    setCart((items) => items.filter((item) => item.work.id !== id));
    setMessage("");
    setEmailUrl("");
  }

  function closeCart() {
    setCartOpen(false);
    setMessage("");
    setEmailUrl("");
  }

  async function submitBidCart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || cart.some((item) => item.amount < 1 || item.amount > MAX_BID || !Number.isFinite(item.amount))) {
      setMessage("Informe um lance válido para cada obra da sua sacola.");
      return;
    }

    const currentWorks = new Map(works.map((work) => [work.id, work]));
    if (cart.some((item) => currentWorks.get(item.work.id)?.status !== "available")) {
      setMessage("Uma das obras não está mais disponível. Atualize o acervo e revise sua sacola.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setEmailUrl("");
    const form = new FormData(event.currentTarget);
    const submittedItems = cart.map((item) => ({ ...item, work: currentWorks.get(item.work.id)! }));
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();

    const { error } = await supabase.rpc("submit_auction_cart", {
      bidder_name: name,
      bidder_email: email,
      bidder_phone: phone,
      preferred_payment_method: "in_person",
      items: submittedItems.map((item) => ({
        artwork_id: item.work.id,
        amount_cents: Math.round(item.amount * 100),
      })),
    });

    if (error) {
      setMessage(error.message || "Não foi possível registrar sua intenção.");
    } else {
      const itemLines = submittedItems
        .map((item) => `• ${item.work.title} (${item.work.code}) — ${money.format(item.amount)}`)
        .join("\n");
      const emailMessage = [
        "Nova intenção de compra — Arte pela Basílica 2026",
        "",
        `Participante: ${name}`,
        `WhatsApp: ${phone}`,
        `E-mail: ${email}`,
        "",
        "Obras selecionadas:",
        itemLines,
        "",
        `Montante da intenção: ${money.format(submittedItems.reduce((sum, item) => sum + item.amount, 0))}`,
        "Pagamento: presencial, a combinar com a equipe.",
      ].join("\n");
      setEmailUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent("Nova intenção de compra — Arte pela Basílica 2026")}&body=${encodeURIComponent(emailMessage)}`);
      setCart([]);
      setMessage("Intenção registrada com sucesso. A equipe analisará os lances e entrará em contato. Nenhuma obra foi reservada ou cobrada nesta etapa.");
    }
    setSubmitting(false);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Basílica Santo Antônio — início">
          <img src={BASILICA_CREST} alt="Brasão da Basílica Santo Antônio" />
          <span><strong>Basílica</strong><small>Santo Antônio</small></span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#evento">O evento</a>
          <a href="#acervo">Obras de arte</a>
          <a href="#como-comprar">Como participar</a>
          <a href="#contato">Fale conosco</a>
        </nav>
        <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir sacola com ${cart.length} obras`}>
          <span>Minha sacola</span><b>{cart.length}</b>
        </button>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-image" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow">Um evento da Basílica Santo Antônio</p>
          <h1>Arte que preserva<br />histórias.</h1>
          <p>Quase 60 obras reunidas em uma noite especial de arte, encontro e contribuição para o futuro da nossa Basílica.</p>
          <div className="hero-actions">
            <a className="button primary" href="#acervo">Conhecer as obras <span>→</span></a>
            <a className="button ghost" href="#evento">Sobre o evento</a>
          </div>
        </div>
      </section>

      <aside className="event-bar" id="evento">
        <div className="event-icon" aria-hidden="true">◇</div>
        <div><span>Evento presencial</span><strong>10 de setembro de 2026</strong></div>
        <div><span>Local</span><strong>Hotel anfitrião · detalhes em breve</strong></div>
        <div><span>Acervo online</span><strong>Disponível até 17 de setembro</strong></div>
        <a href="#acervo">Explorar <span>→</span></a>
      </aside>

      <section className="intro">
        <p className="section-kicker">Arte pela Basílica</p>
        <h2>Uma coleção especial.<br />Um propósito maior.</h2>
        <p className="intro-copy">Selecione as obras que deseja disputar, informe seu lance em cada uma e envie uma única intenção. O total da sua sacola é calculado automaticamente.</p>
        <div className="numbers">
          <div><strong>~60</strong><span>obras selecionadas</span></div>
          <div><strong>10.09</strong><span>evento no hotel</span></div>
          <div><strong>17.09</strong><span>encerramento online</span></div>
        </div>
      </section>

      <section className="catalog-section" id="acervo" aria-busy={catalogLoading}>
        <div className="catalog-heading">
          <div>
            <p className="section-kicker">Acervo 2026</p>
            <h2>Obras disponíveis</h2>
            <p>{catalogLoading ? "Carregando acervo…" : `${availableCount} de ${works.length} obras ainda disponíveis.`}</p>
          </div>
          <div className="filters" aria-label="Filtrar obras">
            <button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => changeFilter("all")}>Todas</button>
            <button aria-pressed={filter === "available"} className={filter === "available" ? "active" : ""} onClick={() => changeFilter("available")}>Disponíveis</button>
            <button aria-pressed={filter === "unavailable"} className={filter === "unavailable" ? "active" : ""} onClick={() => changeFilter("unavailable")}>Indisponíveis</button>
          </div>
        </div>

        {catalogError ? (
          <div className="catalog-error" role="alert">
            <p>{catalogError}</p>
            <button className="button primary" onClick={loadCatalog}>Tentar novamente <span>→</span></button>
          </div>
        ) : (
          <div className="carousel-shell">
            <div className="carousel-toolbar">
              <p>Arraste para explorar ou use as setas</p>
              <div className="carousel-navigation">
                <span aria-live="polite">{visibleWorks.length ? Math.min(carouselIndex + 1, visibleWorks.length) : 0} / {visibleWorks.length}</span>
                <button type="button" onClick={() => moveCarousel(-1)} disabled={carouselIndex === 0} aria-label="Obra anterior">←</button>
                <button type="button" onClick={() => moveCarousel(1)} disabled={carouselIndex >= visibleWorks.length - 1} aria-label="Próxima obra">→</button>
              </div>
            </div>
            <div className="works-carousel" ref={carouselRef} onScroll={syncCarouselIndex} aria-live="polite" aria-label="Carrossel de obras">
            {visibleWorks.map((work) => (
              <article className={`work-card ${work.status !== "available" ? "unavailable" : ""}`} key={work.id}>
                <div className={`work-image ${work.palette}`}>
                  <span className={`status ${work.status}`}>{statusLabel[work.status]}</span>
                  <div className="art-shape shape-one" />
                  <div className="art-shape shape-two" />
                  {work.status !== "available" && (
                    <div className="sold-overlay"><strong>{statusLabel[work.status]}</strong><span>Esta obra não está disponível para proposta.</span></div>
                  )}
                </div>
                <div className="work-body">
                  <span className="work-code">{work.code}</span>
                  <h3>{work.title}</h3>
                  <p>{work.artist}</p>
                  <dl>
                    <div><dt>Técnica</dt><dd>{work.technique}</dd></div>
                    <div><dt>Dimensões</dt><dd>{work.dimensions}</dd></div>
                    <div><dt>Lance</dt><dd>Definido por você</dd></div>
                  </dl>
                  <button disabled={work.status !== "available"} onClick={() => addToCart(work)}>
                    {cart.some((item) => item.work.id === work.id) ? "Na sua sacola" : "Adicionar à sacola"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            ))}
            {!catalogLoading && visibleWorks.length === 0 && <p className="catalog-empty">Nenhuma obra encontrada neste filtro.</p>}
            </div>
          </div>
        )}
      </section>

      <section className="how-section" id="como-comprar">
        <div><p className="section-kicker light">Como participar</p><h2>Registre a sua intenção.<br />Nós cuidamos do restante.</h2></div>
        <ol>
          <li><span>01</span><div><strong>Selecione</strong><p>Adicione à sacola todas as obras que deseja disputar.</p></div></li>
          <li><span>02</span><div><strong>Informe os lances</strong><p>Defina um valor para cada obra e confira o montante total.</p></div></li>
          <li><span>03</span><div><strong>Aguarde a análise</strong><p>A equipe confirma a disponibilidade e combina o pagamento presencial.</p></div></li>
        </ol>
      </section>

      <section className="closing" id="contato">
        <img src={BASILICA_CREST} alt="" />
        <p className="section-kicker">10 de setembro de 2026</p>
        <h2>Faça parte desta história.</h2>
        <p>A intenção não reserva automaticamente a obra e não gera cobrança. A confirmação e o pagamento serão realizados presencialmente com a equipe da Basílica.</p>
        <button className="button primary" onClick={() => setCartOpen(true)}>Abrir minha sacola <span>→</span></button>
      </section>

      <footer>
        <div className="brand footer-brand"><img src={BASILICA_CREST} alt="" /><span><strong>Basílica</strong><small>Santo Antônio</small></span></div>
        <p>Arte pela Basílica · Edição 2026</p>
        <p><a className="admin-link" href="#admin">Área administrativa</a><br />Acervo online até 17 de setembro de 2026</p>
      </footer>

      {cartOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCart()}>
          <section className="purchase-modal cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <button className="modal-close" onClick={closeCart} aria-label="Fechar">×</button>
            <p className="section-kicker">Minha sacola de lances</p>
            <h2 id="cart-title">Intenção de compra</h2>

            {message ? (
              <div className={emailUrl ? "success-message" : "success-message error-message"} role="status">
                <span>{emailUrl ? "✓" : "!"}</span>
                <p>{message}</p>
                {emailUrl && <a className="button email-button" href={emailUrl} target="_blank" rel="noreferrer">Enviar cópia opcional por Gmail <span>↗</span></a>}
                <button onClick={closeCart}>Voltar ao acervo</button>
              </div>
            ) : cart.length === 0 ? (
              <div className="empty-cart">
                <p>Adicione obras do acervo para montar sua intenção de compra.</p>
                <a className="button primary" href="#acervo" onClick={closeCart}>Ver obras <span>→</span></a>
              </div>
            ) : (
              <form onSubmit={submitBidCart}>
                <div className="cart-lines">
                  {cart.map((item) => (
                    <div className="cart-line" key={item.work.id}>
                      <div><strong>{item.work.title}</strong><small>{item.work.code}</small></div>
                      <label>
                        Lance (R$)
                        <input type="number" min="1" max={MAX_BID} step="0.01" inputMode="decimal" value={item.amount || ""} onChange={(event) => updateAmount(item.work.id, Number(event.target.value))} required />
                      </label>
                      <button type="button" onClick={() => removeFromCart(item.work.id)} aria-label={`Remover ${item.work.title}`}>Remover</button>
                    </div>
                  ))}
                </div>
                <div className="cart-total"><span>Montante da intenção</span><strong>{money.format(total)}</strong></div>
                <label>Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
                <label>E-mail<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
                <label>WhatsApp<input name="phone" type="tel" required minLength={5} maxLength={40} autoComplete="tel" /></label>
                <div className="in-person-note"><strong>Pagamento presencial</strong><p>Esta etapa registra uma intenção para análise. Não há reserva automática nem cobrança online.</p></div>
                <button className="button primary" disabled={submitting}>{submitting ? "Registrando intenção…" : "Registrar intenção"} <span>→</span></button>
                <small>Ao enviar, você concorda em ser contatado pela equipe sobre estas obras.</small>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
