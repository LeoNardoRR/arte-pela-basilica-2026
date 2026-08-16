"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_EMAIL, supabase } from "./supabase";
import { ArtworkExperience3D } from "./ArtworkExperience3D";
import { CURATED_ARTWORKS, CuratedArtworkImage } from "./artworkImages";
import { DonationSection } from "./DonationSection";
import { publicAsset } from "./publicAsset";
import { ReservationCountdown } from "./ReservationCountdown";

const BASILICA_CREST = publicAsset("/logo-basilica.jpeg");
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
  price_cents: number | null;
  reserved_until: string | null;
};

type CartItem = { work: Artwork; extraOfferCents: number };
type ReservationReceipt = { confirmation_code: string; expires_at: string; total_cents: number };
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

function displayPrice(cents: number | null) {
  return cents ? formatPrice(cents) : "Valor a confirmar";
}

function artworkReference(work: Artwork): CuratedArtworkImage {
  const parsedSlot = Number(work.code.match(/\d+/)?.[0]);
  const slot = Number.isFinite(parsedSlot) && parsedSlot > 0 ? parsedSlot : work.id;
  const reference = CURATED_ARTWORKS[(slot - 1) % CURATED_ARTWORKS.length];
  return {
    ...reference,
    imageUrl: publicAsset(reference.imageUrl),
    thumbnailUrl: publicAsset(reference.thumbnailUrl),
  };
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
      return Number.isInteger(candidate.work?.id) && Number.isInteger(candidate.extraOfferCents ?? 0);
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
  const [cart, setCart] = useState<CartItem[]>(() => loadSavedCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [emailUrl, setEmailUrl] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<Artwork | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [lastIntentData, setLastIntentData] = useState<{ bidderName: string; code: string; date: string; items: Artwork[] } | null>(null);
  const [reservationReceipt, setReservationReceipt] = useState<ReservationReceipt | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const galleryCloseRef = useRef<HTMLButtonElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const detailScrollerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);

  function toggleAmbientAudio() {
    if (!audioRef.current) {
      const audio = new Audio(publicAsset("/audio-air-bach.ogg"));
      audio.loop = true;
      audio.volume = 0.22;
      audioRef.current = audio;
    }
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      void audioRef.current.play();
      setIsPlayingAudio(true);
    }
  }

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError("");
    await supabase.rpc("release_expired_pre_reservations");
    const { data, error } = await supabase
      .from("artworks")
      .select("id,code,title,artist,technique,dimensions,status,palette,price_cents,reserved_until")
      .order("id", { ascending: true });

    if (error) {
      setCatalogError("Não foi possível carregar o acervo agora. Tente novamente em alguns instantes.");
      setWorks([]);
    } else {
      const freshWorks = (data ?? []) as Artwork[];
      setWorks(freshWorks);
      setCart((items) => items.flatMap((item) => {
        const currentWork = freshWorks.find((work) => work.id === item.work.id);
        return currentWork?.status === "available" ? [{ work: currentWork, extraOfferCents: item.extraOfferCents ?? 0 }] : [];
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
  const totalCents = cart.reduce((sum, item) => sum + (item.work.price_cents ?? 0) + item.extraOfferCents, 0);

  const [openedFromGallery, setOpenedFromGallery] = useState(false);

  function openGallery() {
    setFilter("available");
    setGalleryOpen(true);
  }

  function addToCart(work: Artwork) {
    setCart((items) => items.some((item) => item.work.id === work.id) ? items : [...items, { work, extraOfferCents: 0 }]);
    setMessage("");
    setEmailUrl("");
    setReservationReceipt(null);
    setSelectedWork(null);
  }

  function updateExtraOffer(id: number, reais: string) {
    const cents = Math.min(100000000, Math.max(0, Number(reais.replace(/\D/g, "")) * 100 || 0));
    setCart((items) => items.map((item) => item.work.id === id ? { ...item, extraOfferCents: cents } : item));
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
    if (openedFromGallery) {
      setGalleryOpen(true);
      setOpenedFromGallery(false);
    }
  }

  function openFloatingCart(fromGallery = false) {
    setSelectedWork(null);
    setOpenedFromGallery(fromGallery);
    if (fromGallery) setGalleryOpen(false);
    setCartOpen(true);
  }

  function renderFloatingCart(context: "gallery" | "detail") {
    const itemLabel = cart.length === 1 ? "1 obra" : `${cart.length} obras`;
    const isExpanded = cart.length > 0;
    return (
      <button
        className={`floating-cart floating-cart-${context} ${isExpanded ? "expanded" : "compact"}`}
        type="button"
        onClick={() => openFloatingCart(context === "gallery")}
        aria-label={`Abrir minha seleção com ${itemLabel}`}
      >
        <span className="selection-bag-icon" aria-hidden="true" />
        {isExpanded ? (
          <>
            <span className="floating-cart-copy">
              <small>Minha seleção</small>
              <strong>{itemLabel}</strong>
            </span>
            <span className="floating-cart-total" aria-hidden="true">
              <small>Total</small>
              <strong>{formatPrice(totalCents)}</strong>
            </span>
            <b aria-hidden="true">{cart.length}</b>
          </>
        ) : (
          <span className="floating-cart-label">Minha seleção</span>
        )}
      </button>
    );
  }

  function renderArtworkCard(work: Artwork) {
    const inCart = cart.some((item) => item.work.id === work.id);
    return (
      <article className={`work-card ${work.status !== "available" ? "unavailable" : ""}`} key={work.id}>
        <button className="work-visual-button" type="button" onClick={() => setSelectedWork(work)} aria-label={`Ver detalhes de ${work.title}`}>
          <div className={`work-image ${work.palette}`}>
            <ArtworkPhoto work={work} />
            <span className={`status ${work.status}`}>{statusLabel[work.status]}</span>
            {work.status === "reserved" && work.reserved_until && <ReservationCountdown expiresAt={work.reserved_until} compact />}
            {work.status !== "available" && <div className="sold-overlay"><strong>{statusLabel[work.status]}</strong><span>Indisponível para nova intenção.</span></div>}
            <span className="view-work">Ver detalhes & 3D</span>
          </div>
        </button>
        <div className="work-body">
          <div className="work-heading">
            <span className="work-code">{work.code}</span>
            <strong className="work-price">{displayPrice(work.price_cents)}</strong>
          </div>
          <h3>{work.title}</h3>
          <p className="work-artist-name">{work.artist}</p>
          <p className="work-spec">{work.technique} · {work.dimensions}</p>
          <div className="work-card-actions">
            <button
              className={`button-add-cart ${inCart ? "in-cart" : ""}`}
              type="button"
              disabled={work.status !== "available"}
              onClick={() => (inCart ? removeFromCart(work.id) : addToCart(work))}
            >
              {inCart ? "Na seleção ✓" : "Adicionar"}
            </button>
            <button className="button-view-3d" type="button" onClick={() => setSelectedWork(work)}>
              <span>Detalhes & 3D</span>
              <ArrowIcon direction="up-right" />
            </button>
          </div>
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
    const submittedItems = cart.map((item) => ({ ...item, work: currentWorks.get(item.work.id)! }));
    const submittedWorks = submittedItems.map((item) => item.work);

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setMessage("Informe um WhatsApp válido, com DDD.");
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    const { data, error } = await supabase.rpc("submit_pre_reservation", {
      bidder_name: name,
      bidder_email: email,
      bidder_phone: phone,
      items: submittedItems.map((item) => ({ artwork_id: item.work.id })),
      extra_contribution_cents: submittedItems.reduce((sum, item) => sum + item.extraOfferCents, 0),
      hold_minutes: 30,
    });

    if (error) {
      const safeMessages = ["Preencha nome, e-mail e WhatsApp corretamente.", "A seleção deve ter entre 1 e 20 obras.", "A seleção contém dados inválidos.", "Uma obra não pode aparecer duas vezes na mesma seleção.", "Uma ou mais obras não estão mais disponíveis para pré-reserva."];
      setMessage(safeMessages.includes(error.message) ? error.message : "Não foi possível registrar sua intenção agora. Tente novamente em alguns instantes.");
    } else {
      const receipt = data as ReservationReceipt;
      const itemLines = submittedItems.map((item) => `• ${item.work.title} (${item.work.code}) — ${displayPrice(item.work.price_cents)}${item.extraOfferCents ? ` + oferta de ${formatPrice(item.extraOfferCents)}` : ""}`).join("\n");
      const emailMessage = [
        "Nova intenção de compra — Arte pela Basílica 2026", "", `Interessado: ${name}`, `WhatsApp: ${phone}`, `E-mail: ${email}`, "",
        "Obras selecionadas:", itemLines, "", `Valor total: ${formatPrice(totalCents)}`, "Conclusão e pagamento: presencial, com a equipe do evento.",
      ].join("\n");
      setLastIntentData({
        bidderName: name,
        code: receipt.confirmation_code,
        date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
        items: submittedWorks,
      });
      setReservationReceipt(receipt);
      setEmailUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent("Intenção de compra — Arte pela Basílica 2026")}&body=${encodeURIComponent(emailMessage)}`);
      setCart([]);
      setMessage("Sua pré-reserva foi registrada e as obras estão bloqueadas temporariamente.");
      void loadCatalog();
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
        <nav aria-label="Navegação principal"><a href="#exposicao">A exposição</a><a href="#acervo">Acervo</a><a href="#como-participar">Como adquirir</a><a href="#doacao">Doar</a><a href="#parceiros">Parceiros</a></nav>
        <button className={`ambient-audio-button ${isPlayingAudio ? "playing" : ""}`} type="button" onClick={toggleAmbientAudio} aria-label={isPlayingAudio ? "Desligar som ambiente" : "Ligar som ambiente"} title={isPlayingAudio ? "Som ligado" : "Som ambiente"}>
          <span className="audio-icon" aria-hidden="true">{isPlayingAudio ? "🔊" : "🔈"}</span>
        </button>
        <a className="mobile-catalog-link" href="#acervo">Acervo</a>
        <a className="admin-menu-link" href="#admin" aria-label="Acessar área administrativa">Administrativo</a>
        <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir seleção com ${cart.length} obras`}><span>Minha seleção</span><b>{cart.length}</b></button>
      </header>

      <section className="hero" id="conteudo-principal">
        <div className="hero-image" ref={heroImageRef} /><div className="hero-overlay" />
        <div className="hero-content"><p className="eyebrow">Exposição beneficente · Edição 2026</p><h1>Arte que atravessa<br />o tempo.</h1><p>Uma seleção singular de obras reunidas em favor da preservação da Basílica Santo Antônio.</p><div className="hero-actions"><a className="button primary" href="#acervo">Explorar o acervo <ArrowIcon /></a><a className="button ghost" href="#exposicao">Conhecer a exposição</a></div></div>
        <a className="hero-scroll-cue" href="#exposicao"><span>Descubra a coleção</span><i aria-hidden="true" /></a>
      </section>

      <aside className="event-bar" id="exposicao" data-reveal="up"><div className="event-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 2 9.5 5.5 10.2 7.8C10.6 9.2 12 9.5 12 9.5C12 9.5 13.4 9.2 13.8 7.8C14.5 5.5 12 2 12 2Z" fill="currentColor" opacity="0.9"/><rect x="10.5" y="9" width="3" height="11" rx="1.5" fill="currentColor" opacity="0.85"/><ellipse cx="12" cy="20.5" rx="3.5" ry="1" fill="currentColor" opacity="0.2"/></svg></div><div><span>Exposição presencial</span><strong>10 de setembro de 2026</strong></div><div><span>Local</span><strong>Av. de Cillo, 820 — Americana, SP</strong></div><div><span>Endereço completo</span><strong>Jd. São Pedro · CEP 13466-550</strong></div><a href="#acervo">Visitar acervo <ArrowIcon /></a></aside>

      <section className="intro" data-reveal="up"><p className="section-kicker">Arte pela Basílica</p><h2>Uma coleção com propósito.<br />Uma experiência para guardar.</h2><p className="intro-copy">Escolha suas peças, informe uma oferta adicional se desejar e faça uma pré-reserva de 30 minutos. Durante o prazo, as obras ficam bloqueadas para outros visitantes e a conclusão acontece presencialmente.</p><div className="numbers"><div><strong>84</strong><span>obras reais no catálogo</span></div><div><strong>30 min</strong><span>de bloqueio temporário</span></div><div><strong>1 gesto</strong><span>em favor da Basílica</span></div></div></section>

      <section className="catalog-section" id="acervo" aria-busy={catalogLoading}>
        <div className="catalog-heading" data-reveal="up"><div><p className="section-kicker">Catálogo da exposição</p><h2>Obras selecionadas</h2><p>{catalogLoading ? "Preparando o acervo…" : `${availableCount} obras disponíveis para intenção de compra.`}</p></div><button className="button catalog-expand-button" type="button" onClick={openGallery} disabled={catalogLoading || works.length === 0}>Entrar na galeria <ArrowIcon direction="up-right" /></button></div>
        {catalogError ? <div className="catalog-error" role="alert"><p>{catalogError}</p><button className="button primary" onClick={loadCatalog}>Tentar novamente <ArrowIcon /></button></div> : (
          <div className="collection-preview" data-reveal="up"><div className="collection-copy"><span className="collection-label">Curadoria 2026</span><h3>Observe os detalhes. Escolha com calma.</h3><p>Uma galeria editorial para descobrir cada obra sem distrações. Ao abrir os detalhes, arraste o quadro com o dedo ou mouse para observar frente, espessura e verso.</p><div className="collection-stats"><div><strong>{works.length}</strong><span>obras catalogadas</span></div><div><strong>{availableCount}</strong><span>disponíveis agora</span></div></div><button className="button gallery-open-button" type="button" onClick={openGallery} disabled={catalogLoading || works.length === 0}>Abrir galeria <ArrowIcon direction="up-right" /></button></div><div className="preview-curation" aria-hidden="true">{previewWorks.map((work, index) => <div className={`preview-piece preview-piece-${index + 1}`} key={work.id}><div className={`work-image ${work.palette}`}><ArtworkPhoto work={work} eager /></div><div className="preview-piece-caption"><span>{work.code}</span><strong>{work.title}</strong><small>{work.dimensions}</small></div></div>)}</div></div>
        )}
      </section>

      <section className="how-section" id="como-participar" data-reveal="up"><div><p className="section-kicker light">Como adquirir</p><h2>Sua obra bloqueada.<br />A compra, presencial.</h2></div><ol><li><span>01</span><div><strong>Escolha as obras</strong><p>Explore o acervo, confira os valores e adicione as peças à sua seleção.</p></div></li><li><span>02</span><div><strong>Faça a pré-reserva</strong><p>Informe seus dados e, se quiser, acrescente uma oferta acima do valor padrão.</p></div></li><li><span>03</span><div><strong>Conclua em 30 minutos</strong><p>Vá à Basílica, apresente o protocolo e efetue o pagamento presencial antes da expiração.</p></div></li></ol></section>

      <DonationSection />

      <section className="sponsors-section" id="parceiros" data-reveal="up"><p className="section-kicker">Realização e parceiros</p><h2>Quem torna este encontro possível.</h2><div className="sponsor-logos"><img src={publicAsset("/sponsors/hotel-florenca.png")} alt="Hotel Florença" /><img src={publicAsset("/sponsors/contatto.png")} alt="Contatto Transportes" /><img src={publicAsset("/sponsors/beauty-flor.webp")} alt="Buquê de Flor" /><img src={publicAsset("/sponsors/quadrum.jpg")} alt="Quadrum" /><img src={publicAsset("/sponsors/juarez-godoy.jpg")} alt="Juarez Godoy Arte e Cultura" /></div></section>

      <section className="closing" id="contato" data-reveal="up"><img src={BASILICA_CREST} alt="" /><p className="section-kicker">10 de setembro de 2026</p><h2>Leve uma obra.<br />Faça parte desta história.</h2><p>A pré-reserva bloqueia a obra por 30 minutos, mas não gera cobrança online. A posse somente é confirmada após o pagamento presencial dentro do prazo.</p><button className="button primary" onClick={() => setCartOpen(true)}>Revisar minha seleção <ArrowIcon /></button></section>

      <footer><div className="brand footer-brand"><img src={BASILICA_CREST} alt="" /><span><strong>Basílica</strong><small>Santo Antônio</small></span></div><p>Arte pela Basílica · Edição 2026<br /><a href="https://commons.wikimedia.org/wiki/File:Air.ogg" target="_blank" rel="noreferrer">Áudio: Bach, Air · U.S. Air Force Band · domínio público</a></p><p><a className="admin-link" href="#admin">Área administrativa</a><br />Acervo online até 17 de setembro</p></footer>
      </div>

      {galleryOpen && <section className="gallery-overlay" role="dialog" aria-modal="true" aria-labelledby="gallery-title"><header className="gallery-header"><div><p className="section-kicker">Acervo 2026</p><h2 id="gallery-title">Galeria de obras</h2><span>{visibleWorks.length} {visibleWorks.length === 1 ? "obra exibida" : "obras exibidas"}</span></div><div className="gallery-actions"><div className="filters" aria-label="Filtrar obras"><button aria-pressed={filter === "available"} className={filter === "available" ? "active" : ""} onClick={() => setFilter("available")}>Disponíveis <small>{availableCount}</small></button><button aria-pressed={filter === "unavailable"} className={filter === "unavailable" ? "active" : ""} onClick={() => setFilter("unavailable")}>Indisponíveis <small>{works.length - availableCount}</small></button><button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas <small>{works.length}</small></button></div><button ref={galleryCloseRef} className="gallery-close" type="button" onClick={() => setGalleryOpen(false)} aria-label="Fechar galeria">×</button></div></header><div className="gallery-content"><div className="gallery-grid" aria-live="polite">{visibleWorks.map(renderArtworkCard)}{visibleWorks.length === 0 && <p className="catalog-empty">Nenhuma obra encontrada neste filtro.</p>}</div></div>{renderFloatingCart("gallery")}</section>}

      {selectedWork && <div ref={detailScrollerRef} className="detail-backdrop" role="presentation"><section className="artwork-detail" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button ref={detailCloseRef} className="modal-close detail-close" onClick={() => setSelectedWork(null)} aria-label="Fechar detalhes">×</button><ArtworkExperience3D work={selectedWork} reference={artworkReference(selectedWork)} scrollerRef={detailScrollerRef} /><div className="detail-copy"><div><span className="section-kicker">Ficha da obra</span><h3 id="detail-title">{selectedWork.title}</h3><p className="detail-artist">{selectedWork.artist}</p><dl><div><dt>Técnica</dt><dd>{selectedWork.technique}</dd></div><div><dt>Dimensões</dt><dd>{selectedWork.dimensions}</dd></div><div><dt>Disponibilidade</dt><dd>{statusLabel[selectedWork.status]}</dd></div></dl><p className="reference-credit">Imagem oficial fornecida no Catálogo Vernissage 2026.</p></div><div className="detail-purchase"><div className="detail-price"><span>Valor padrão da obra</span><strong>{displayPrice(selectedWork.price_cents)}</strong><small>Você pode acrescentar uma oferta na pré-reserva</small></div>{selectedWork.status === "reserved" && selectedWork.reserved_until && <ReservationCountdown expiresAt={selectedWork.reserved_until} />}<button className="button primary" disabled={selectedWork.status !== "available" || cart.some((item) => item.work.id === selectedWork.id)} onClick={() => addToCart(selectedWork)}>{cart.some((item) => item.work.id === selectedWork.id) ? "Obra já selecionada" : "Pré-reservar esta obra"}<ArrowIcon /></button></div></div></section></div>}

      {cartOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCart()}><section className="purchase-modal cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-title"><button className="modal-close" onClick={closeCart} aria-label="Fechar seleção">×</button><p className="section-kicker">Sua seleção</p><h2 id="cart-title">Pré-reserva temporária</h2><p className="modal-note">Ao confirmar, as obras serão bloqueadas por 30 minutos. O pagamento e a confirmação da posse acontecem presencialmente na Basílica.</p>
        {message ? (
          <div className={emailUrl ? "success-message" : "success-message error-message"} role="status">
            <span>{emailUrl ? "✓" : "!"}</span>
            <p>{message}</p>
            {lastIntentData && (
              <div className="intent-certificate">
                <div className="certificate-header">
                  <img src={BASILICA_CREST} alt="" />
                  <div>
                    <strong>Selo de Intenção Registrada</strong>
                    <small>Basílica Santo Antônio · Edição 2026</small>
                  </div>
                </div>
                <div className="certificate-body">
                  <div className="certificate-row"><span>Protocolo</span><strong>{lastIntentData.code}</strong></div>
                  <div className="certificate-row"><span>Titular</span><strong>{lastIntentData.bidderName}</strong></div>
                  <div className="certificate-row"><span>Data de Emissão</span><strong>{lastIntentData.date}</strong></div>
                  <div className="certificate-items">
                    <small>Obras reservadas em curadoria:</small>
                    <ul>{lastIntentData.items.map((w) => <li key={w.id}><b>{w.code}</b> — {w.title}</li>)}</ul>
                  </div>
                </div>
                <div className="certificate-footer">
                  <span>Preservação do Patrimônio Sacro</span>
                  <small>Apresente este protocolo presencialmente na Basílica antes da expiração.</small>
                </div>
              </div>
            )}
            {reservationReceipt && <ReservationCountdown expiresAt={reservationReceipt.expires_at} />}
            {emailUrl && <a className="button email-button" href={emailUrl} target="_blank" rel="noreferrer">Enviar cópia por Gmail <ArrowIcon direction="up-right" /></a>}
            <button className="button primary" onClick={closeCart} style={{ marginTop: "16px" }}>Voltar ao acervo</button>
          </div>
        ) : cart.length === 0 ? <div className="empty-cart"><p>Sua seleção está vazia. Explore a galeria e escolha as obras de seu interesse.</p><a className="button primary" href="#acervo" onClick={closeCart}>Explorar acervo <ArrowIcon /></a></div> : <form onSubmit={submitPurchaseIntent}><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.work.id}><div className={`cart-thumb work-image ${item.work.palette}`}><ArtworkPhoto work={item.work} /></div><div className="cart-line-info"><small>{item.work.code}</small><strong>{item.work.title}</strong><span>{displayPrice(item.work.price_cents)}</span><label className="extra-offer">Oferta adicional (opcional)<span><b>R$</b><input inputMode="numeric" value={item.extraOfferCents ? String(item.extraOfferCents / 100) : ""} onChange={(event) => updateExtraOffer(item.work.id, event.target.value)} placeholder="0" aria-label={`Oferta adicional para ${item.work.title}`} /></span></label></div><button type="button" onClick={() => removeFromCart(item.work.id)} aria-label={`Remover ${item.work.title}`}>Remover</button></div>)}</div><div className="cart-total"><span>Valor base + ofertas</span><strong>{formatPrice(totalCents)}</strong></div><div className="contact-fields"><label>Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Como devemos chamar você?" /></label><label>E-mail<input name="email" type="email" required maxLength={160} autoComplete="email" placeholder="voce@email.com" /></label><label>WhatsApp<input name="phone" type="tel" required minLength={8} maxLength={40} autoComplete="tel" placeholder="(11) 99999-9999" /></label></div><div className="in-person-note"><strong>Bloqueio temporário · sem pagamento online</strong><p>Após confirmar, dirija-se à Basílica Santo Antônio, na R. Vieira Bueno, 150, em até 30 minutos. Ao expirar, as obras serão liberadas automaticamente.</p></div><button className="button primary submit-intent" disabled={submitting}>{submitting ? "Bloqueando obras…" : "Confirmar pré-reserva por 30 min"}<ArrowIcon /></button><small className="form-consent">Ao enviar, você concorda em ser contatado pela equipe sobre esta pré-reserva.</small></form>}
      </section></div>}
    </main>
  );
}
