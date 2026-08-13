"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_EMAIL, supabase } from "./supabase";
import { ArtworkExperience3D } from "./ArtworkExperience3D";
import { CURATED_ARTWORKS, CuratedArtworkImage } from "./artworkImages";

const BASILICA_CREST = "/logo-basilica.jpeg";
const CART_STORAGE_KEY = "arte-pela-basilica-cart-v2";

type Artwork = {
  id: number;
  code: string;
  title: string;
  artist: string;
  technique: string;
  dimensions: string;
  status: "available" | "reserved" | "sold";
  palette: string;
  price_cents: number;
};

type CartItem = { work: Artwork };
type CatalogFilter = "all" | "available" | "unavailable";

const statusLabel = {
  available: "Disponível",
  reserved: "Em negociação",
  sold: "Adquirida",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatPrice(cents: number) {
  return money.format(cents / 100);
}

function artworkReference(work: Artwork): CuratedArtworkImage {
  const parsedSlot = Number(work.code.match(/\d+/)?.[0]);
  const slot = Number.isFinite(parsedSlot) && parsedSlot > 0 ? parsedSlot : work.id;
  return CURATED_ARTWORKS[(slot - 1) % CURATED_ARTWORKS.length];
}

function ArrowIcon({ direction = "right" }: { direction?: "right" | "up-right" | "down" | "left" }) {
  return <span className={`arrow-icon arrow-${direction}`} aria-hidden="true" />;
}

function ArtworkPhoto({ work, eager = false }: { work: Artwork; eager?: boolean }) {
  const reference = artworkReference(work);
  return (
    <img
      className="artwork-photo"
      src={eager ? reference.imageUrl : reference.thumbnailUrl}
      alt={`${reference.title}, de ${reference.artist}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(event) => {
        const image = event.currentTarget;
        const frame = image.parentElement;
        if (frame && image.naturalWidth > 0 && image.naturalHeight > 0) {
          frame.style.setProperty("--artwork-aspect", `${image.naturalWidth} / ${image.naturalHeight}`);
        }
      }}
      onError={(event) => { event.currentTarget.hidden = true; }}
    />
  );
}

function loadSavedCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as CartItem;
      return Number.isInteger(candidate.work?.id);
    });
  } catch {
    return [];
  }
}

export function Catalog() {
  const [works, setWorks] = useState<Artwork[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("available");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [emailUrl, setEmailUrl] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<Artwork | null>(null);
  const galleryCloseRef = useRef<HTMLButtonElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const detailScrollerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError("");
    const { data, error } = await supabase
      .from("artworks")
      .select("id,code,title,artist,technique,dimensions,status,palette,price_cents")
      .order("id", { ascending: true });

    if (error) {
      setCatalogError("Não foi possível carregar o acervo agora. Tente novamente em alguns instantes.");
      setWorks([]);
    } else {
      const freshWorks = (data ?? []) as Artwork[];
      setWorks(freshWorks);
      setCart((items) => items.flatMap((item) => {
        const currentWork = freshWorks.find((work) => work.id === item.work.id);
        return currentWork?.status === "available" ? [{ work: currentWork }] : [];
      }));
    }
    setCatalogLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(loadSavedCart());
      void loadCatalog();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (prefersReducedMotion) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    revealNodes.forEach((node) => observer.observe(node));

    let animationFrame = 0;
    const updateScrollEffects = () => {
      const scrollTop = window.scrollY;
      const scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      if (heroImageRef.current) {
        heroImageRef.current.style.transform = `translate3d(0, ${Math.min(scrollTop * 0.13, 90)}px, 0) scale(1.08)`;
      }
      if (scrollProgressRef.current) {
        scrollProgressRef.current.style.transform = `scaleX(${Math.min(scrollTop / scrollRange, 1)})`;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateScrollEffects);
    };
    updateScrollEffects();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The cart remains usable in memory when browser storage is unavailable.
    }
  }, [cart]);

  const modalOpen = cartOpen || galleryOpen || Boolean(selectedWork);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedWork) setSelectedWork(null);
      else if (galleryOpen) setGalleryOpen(false);
      else setCartOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, galleryOpen, selectedWork]);

  useEffect(() => {
    if (modalOpen && !modalTriggerRef.current) {
      modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (!modalOpen && modalTriggerRef.current) {
      modalTriggerRef.current.focus();
      modalTriggerRef.current = null;
      return;
    }

    const dialog = document.querySelector<HTMLElement>(selectedWork ? ".artwork-detail" : galleryOpen ? ".gallery-overlay" : ".cart-modal");
    if (!dialog) return;
    const backgroundGallery = selectedWork ? document.querySelector<HTMLElement>(".gallery-overlay") : null;
    if (backgroundGallery) {
      backgroundGallery.inert = true;
      backgroundGallery.setAttribute("aria-hidden", "true");
    }
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    focusable[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      if (backgroundGallery) {
        backgroundGallery.inert = false;
        backgroundGallery.removeAttribute("aria-hidden");
      }
    };
  }, [modalOpen, cartOpen, galleryOpen, selectedWork]);

  useEffect(() => {
    if (!galleryOpen || selectedWork) return;
    const timer = window.setTimeout(() => galleryCloseRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [galleryOpen, selectedWork]);

  const visibleWorks = useMemo(() => {
    if (filter === "available") return works.filter((work) => work.status === "available");
    if (filter === "unavailable") return works.filter((work) => work.status !== "available");
    return [...works].sort((a, b) => Number(a.status !== "available") - Number(b.status !== "available") || a.id - b.id);
  }, [filter, works]);

  const availableCount = works.filter((work) => work.status === "available").length;
  const previewWorks = works.filter((work) => work.status === "available").slice(0, 3);
  const totalCents = cart.reduce((sum, item) => sum + item.work.price_cents, 0);

  function openGallery() {
    setFilter("available");
    setGalleryOpen(true);
  }

  function addToCart(work: Artwork) {
    setCart((items) => items.some((item) => item.work.id === work.id) ? items : [...items, { work }]);
    setMessage("");
    setEmailUrl("");
    setSelectedWork(null);
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

  function renderArtworkCard(work: Artwork) {
    return (
      <article className={`work-card ${work.status !== "available" ? "unavailable" : ""}`} key={work.id}>
        <button className="work-visual-button" type="button" onClick={() => setSelectedWork(work)} aria-label={`Ver detalhes de ${work.title}`}>
          <div className={`work-image ${work.palette}`}>
            <ArtworkPhoto work={work} />
            <span className={`status ${work.status}`}>{statusLabel[work.status]}</span>
            {work.status !== "available" && <div className="sold-overlay"><strong>{statusLabel[work.status]}</strong><span>Indisponível para nova intenção.</span></div>}
            <span className="view-work">Ver obra</span>
          </div>
        </button>
        <div className="work-body">
          <div className="work-heading"><span className="work-code">{work.code}</span><strong className="work-price">{formatPrice(work.price_cents)}</strong></div>
          <h3>{work.title}</h3>
          <p>{work.artist}</p>
          <p className="work-spec">{work.technique} · {work.dimensions}</p>
          <button className="work-detail-link" type="button" onClick={() => setSelectedWork(work)}>
            Ver detalhes <ArrowIcon direction="up-right" />
          </button>
        </div>
      </article>
    );
  }

  async function submitPurchaseIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) {
      setMessage("Adicione pelo menos uma obra à sua seleção.");
      return;
    }

    const currentWorks = new Map(works.map((work) => [work.id, work]));
    if (cart.some((item) => currentWorks.get(item.work.id)?.status !== "available")) {
      setMessage("Uma das obras não está mais disponível. Atualize o acervo e revise sua seleção.");
      return;
    }
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    setEmailUrl("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const submittedWorks = cart.map((item) => currentWorks.get(item.work.id)!);

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setMessage("Informe um WhatsApp válido, com DDD.");
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    const { error } = await supabase.rpc("submit_purchase_intent", {
      bidder_name: name,
      bidder_email: email,
      bidder_phone: phone,
      items: submittedWorks.map((work) => ({ artwork_id: work.id })),
    });

    if (error) {
      const safeMessages = ["Preencha nome, e-mail e WhatsApp corretamente.", "A seleção deve ter entre 1 e 20 obras.", "A seleção contém dados inválidos.", "Uma obra não pode aparecer duas vezes na mesma seleção.", "Uma ou mais obras não estão mais disponíveis para intenção."];
      setMessage(safeMessages.includes(error.message) ? error.message : "Não foi possível registrar sua intenção agora. Tente novamente em alguns instantes.");
    } else {
      const itemLines = submittedWorks.map((work) => `• ${work.title} (${work.code}) — ${formatPrice(work.price_cents)}`).join("\n");
      const emailMessage = [
        "Nova intenção de compra — Arte pela Basílica 2026", "", `Interessado: ${name}`, `WhatsApp: ${phone}`, `E-mail: ${email}`, "",
        "Obras selecionadas:", itemLines, "", `Valor total: ${formatPrice(totalCents)}`, "Conclusão e pagamento: presencial, com a equipe do evento.",
      ].join("\n");
      setEmailUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent("Intenção de compra — Arte pela Basílica 2026")}&body=${encodeURIComponent(emailMessage)}`);
      setCart([]);
      setMessage("Intenção registrada. A equipe recebeu sua seleção e entrará em contato. Nenhuma cobrança foi realizada e a compra será concluída presencialmente.");
    }
    setSubmitting(false);
    submittingRef.current = false;
  }

  return (
    <main>
      <div className="scroll-progress" ref={scrollProgressRef} aria-hidden="true" />
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
      <div className="page-shell" inert={modalOpen ? true : undefined} aria-hidden={modalOpen ? true : undefined}>
      <header className="site-header">
        <a className="brand" href="#conteudo-principal" aria-label="Basílica Santo Antônio — início"><img src={BASILICA_CREST} alt="Brasão da Basílica Santo Antônio" /><span><strong>Basílica</strong><small>Santo Antônio</small></span></a>
        <nav aria-label="Navegação principal"><a href="#exposicao">A exposição</a><a href="#acervo">Acervo</a><a href="#como-participar">Como adquirir</a><a href="#contato">Contato</a></nav>
        <a className="mobile-catalog-link" href="#acervo">Acervo</a>
        <a className="admin-menu-link" href="#admin" aria-label="Acessar área administrativa">Administrativo</a>
        <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir seleção com ${cart.length} obras`}><span>Minha seleção</span><b>{cart.length}</b></button>
      </header>

      <section className="hero" id="conteudo-principal">
        <div className="hero-image" ref={heroImageRef} /><div className="hero-overlay" />
        <div className="hero-content"><p className="eyebrow">Exposição beneficente · Edição 2026</p><h1>Arte que atravessa<br />o tempo.</h1><p>Uma seleção singular de obras reunidas em favor da preservação da Basílica Santo Antônio.</p><div className="hero-actions"><a className="button primary" href="#acervo">Explorar o acervo <ArrowIcon /></a><a className="button ghost" href="#exposicao">Conhecer a exposição</a></div></div>
        <a className="hero-scroll-cue" href="#exposicao"><span>Descubra a coleção</span><i aria-hidden="true" /></a>
      </section>

      <aside className="event-bar" id="exposicao" data-reveal="up"><div className="event-icon" aria-hidden="true">◇</div><div><span>Exposição presencial</span><strong>10 de setembro de 2026</strong></div><div><span>Encontro</span><strong>Hotel anfitrião · detalhes em breve</strong></div><div><span>Acervo online</span><strong>Disponível até 17 de setembro</strong></div><a href="#acervo">Visitar acervo <ArrowIcon /></a></aside>

      <section className="intro" data-reveal="up"><p className="section-kicker">Arte pela Basílica</p><h2>Uma coleção com propósito.<br />Uma experiência para guardar.</h2><p className="intro-copy">Cada obra possui valor fixo. Escolha suas peças, registre seu interesse e deixe seus dados. A equipe organizará o atendimento e a conclusão da compra presencialmente no evento.</p><div className="numbers"><div><strong>60</strong><span>obras em exposição</span></div><div><strong>10.09</strong><span>encontro presencial</span></div><div><strong>1 gesto</strong><span>em favor da Basílica</span></div></div></section>

      <section className="catalog-section" id="acervo" aria-busy={catalogLoading}>
        <div className="catalog-heading" data-reveal="up"><div><p className="section-kicker">Catálogo da exposição</p><h2>Obras selecionadas</h2><p>{catalogLoading ? "Preparando o acervo…" : `${availableCount} obras disponíveis para intenção de compra.`}</p></div><button className="button catalog-expand-button" type="button" onClick={openGallery} disabled={catalogLoading || works.length === 0}>Entrar na galeria <ArrowIcon direction="up-right" /></button></div>
        {catalogError ? <div className="catalog-error" role="alert"><p>{catalogError}</p><button className="button primary" onClick={loadCatalog}>Tentar novamente <ArrowIcon /></button></div> : (
          <div className="collection-preview" data-reveal="up"><div className="collection-copy"><span className="collection-label">Curadoria 2026</span><h3>Observe os detalhes. Escolha com calma.</h3><p>Uma galeria editorial para descobrir cada obra sem distrações. Ao abrir os detalhes, arraste o quadro com o dedo ou mouse para observar frente, espessura e verso.</p><div className="collection-stats"><div><strong>{works.length}</strong><span>obras catalogadas</span></div><div><strong>{availableCount}</strong><span>disponíveis agora</span></div></div><button className="button gallery-open-button" type="button" onClick={openGallery} disabled={catalogLoading || works.length === 0}>Abrir galeria <ArrowIcon direction="up-right" /></button></div><div className="preview-curation" aria-hidden="true">{previewWorks.map((work, index) => <div className={`preview-piece preview-piece-${index + 1}`} key={work.id}><div className={`work-image ${work.palette}`}><ArtworkPhoto work={work} eager /></div><div className="preview-piece-caption"><span>{work.code}</span><strong>{work.title}</strong><small>{work.dimensions}</small></div></div>)}</div></div>
        )}
      </section>

      <section className="how-section" id="como-participar" data-reveal="up"><div><p className="section-kicker light">Como adquirir</p><h2>Seu interesse registrado.<br />A compra, no encontro.</h2></div><ol><li><span>01</span><div><strong>Escolha as obras</strong><p>Explore o acervo e adicione à sua seleção as peças que deseja adquirir.</p></div></li><li><span>02</span><div><strong>Envie sua intenção</strong><p>Confira os valores fixos e informe seu contato em um único envio.</p></div></li><li><span>03</span><div><strong>Conclua presencialmente</strong><p>A equipe entra em contato e finaliza a compra no dia do evento.</p></div></li></ol></section>

      <section className="closing" id="contato" data-reveal="up"><img src={BASILICA_CREST} alt="" /><p className="section-kicker">10 de setembro de 2026</p><h2>Leve uma obra.<br />Faça parte desta história.</h2><p>O registro de intenção não gera cobrança online nem reserva automática. A disponibilidade será confirmada pela equipe e a compra acontecerá presencialmente.</p><button className="button primary" onClick={() => setCartOpen(true)}>Revisar minha seleção <ArrowIcon /></button></section>

      <footer><div className="brand footer-brand"><img src={BASILICA_CREST} alt="" /><span><strong>Basílica</strong><small>Santo Antônio</small></span></div><p>Arte pela Basílica · Edição 2026</p><p><a className="admin-link" href="#admin">Área administrativa</a><br />Acervo online até 17 de setembro</p></footer>
      </div>

      {galleryOpen && <section className="gallery-overlay" role="dialog" aria-modal="true" aria-labelledby="gallery-title"><header className="gallery-header"><div><p className="section-kicker">Acervo 2026</p><h2 id="gallery-title">Galeria de obras</h2><span>{visibleWorks.length} {visibleWorks.length === 1 ? "obra exibida" : "obras exibidas"}</span></div><div className="gallery-actions"><div className="filters" aria-label="Filtrar obras"><button aria-pressed={filter === "available"} className={filter === "available" ? "active" : ""} onClick={() => setFilter("available")}>Disponíveis <small>{availableCount}</small></button><button aria-pressed={filter === "unavailable"} className={filter === "unavailable" ? "active" : ""} onClick={() => setFilter("unavailable")}>Indisponíveis <small>{works.length - availableCount}</small></button><button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas <small>{works.length}</small></button></div><button ref={galleryCloseRef} className="gallery-close" type="button" onClick={() => setGalleryOpen(false)} aria-label="Fechar galeria">×</button></div></header><div className="gallery-content"><div className="gallery-grid" aria-live="polite">{visibleWorks.map(renderArtworkCard)}{visibleWorks.length === 0 && <p className="catalog-empty">Nenhuma obra encontrada neste filtro.</p>}</div></div></section>}

      {selectedWork && <div ref={detailScrollerRef} className="detail-backdrop" role="presentation"><section className="artwork-detail" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button ref={detailCloseRef} className="modal-close detail-close" onClick={() => setSelectedWork(null)} aria-label="Fechar detalhes">×</button><ArtworkExperience3D work={selectedWork} reference={artworkReference(selectedWork)} scrollerRef={detailScrollerRef} /><div className="detail-copy"><div><span className="section-kicker">Ficha da obra</span><h3 id="detail-title">{selectedWork.title}</h3><p className="detail-artist">{selectedWork.artist}</p><dl><div><dt>Técnica</dt><dd>{selectedWork.technique}</dd></div><div><dt>Dimensões</dt><dd>{selectedWork.dimensions}</dd></div><div><dt>Disponibilidade</dt><dd>{statusLabel[selectedWork.status]}</dd></div></dl><p className="reference-credit">Imagem de referência em domínio público: <a href={artworkReference(selectedWork).sourceUrl} target="_blank" rel="noreferrer">{artworkReference(selectedWork).title}, {artworkReference(selectedWork).artist} <ArrowIcon direction="up-right" /></a></p></div><div className="detail-purchase"><div className="detail-price"><span>Valor da obra</span><strong>{formatPrice(selectedWork.price_cents)}</strong><small>Compra e pagamento presenciais</small></div><button className="button primary" disabled={selectedWork.status !== "available" || cart.some((item) => item.work.id === selectedWork.id)} onClick={() => addToCart(selectedWork)}>{cart.some((item) => item.work.id === selectedWork.id) ? "Obra já selecionada" : "Adicionar à seleção"}<ArrowIcon /></button></div></div></section></div>}

      {cartOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCart()}><section className="purchase-modal cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title"><button className="modal-close" onClick={closeCart} aria-label="Fechar seleção">×</button><p className="section-kicker">Sua seleção</p><h2 id="cart-title">Intenção de compra</h2><p className="modal-note">Confira as obras e deixe seus dados. Esta etapa não realiza pagamento.</p>
        {message ? <div className={emailUrl ? "success-message" : "success-message error-message"} role="status"><span>{emailUrl ? "✓" : "!"}</span><p>{message}</p>{emailUrl && <a className="button email-button" href={emailUrl} target="_blank" rel="noreferrer">Enviar cópia por Gmail <ArrowIcon direction="up-right" /></a>}<button onClick={closeCart}>Voltar ao acervo</button></div> : cart.length === 0 ? <div className="empty-cart"><p>Sua seleção está vazia. Explore a galeria e escolha as obras de seu interesse.</p><a className="button primary" href="#acervo" onClick={closeCart}>Explorar acervo <ArrowIcon /></a></div> : <form onSubmit={submitPurchaseIntent}><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.work.id}><div className={`cart-thumb work-image ${item.work.palette}`}><ArtworkPhoto work={item.work} /></div><div className="cart-line-info"><small>{item.work.code}</small><strong>{item.work.title}</strong><span>{formatPrice(item.work.price_cents)}</span></div><button type="button" onClick={() => removeFromCart(item.work.id)} aria-label={`Remover ${item.work.title}`}>Remover</button></div>)}</div><div className="cart-total"><span>Valor total da seleção</span><strong>{formatPrice(totalCents)}</strong></div><div className="contact-fields"><label>Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Como devemos chamar você?" /></label><label>E-mail<input name="email" type="email" required maxLength={160} autoComplete="email" placeholder="voce@email.com" /></label><label>WhatsApp<input name="phone" type="tel" required minLength={8} maxLength={40} autoComplete="tel" placeholder="(11) 99999-9999" /></label></div><div className="in-person-note"><strong>Sem pagamento online</strong><p>Você está registrando interesse nestas obras. A equipe confirmará a disponibilidade e concluirá a compra presencialmente no evento.</p></div><button className="button primary submit-intent" disabled={submitting}>{submitting ? "Registrando intenção…" : "Registrar intenção de compra"}<ArrowIcon /></button><small className="form-consent">Ao enviar, você concorda em ser contatado pela equipe sobre esta seleção.</small></form>}
      </section></div>}
    </main>
  );
}
