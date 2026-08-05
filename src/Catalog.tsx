"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const SUPABASE_URL = "https://luodxzttfbnnufxufehb.supabase.co";
const SUPABASE_KEY = "sb_publishable_rmXVP-5JoFt5xTF6humZPQ_oQAWLm2n";
const BASILICA_CREST = "https://arte-pela-basilica-2026.ribeiroleonardoti.chatgpt.site/brasao-basilica.png";

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  "Content-Type": "application/json",
};

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

const fallbackWorks: Artwork[] = [
  { id: 1, code: "OB-001", title: "Luz da manhã", artist: "Artista a confirmar", technique: "Óleo sobre tela", dimensions: "80 × 60 cm", status: "available", palette: "sunrise" },
  { id: 2, code: "OB-002", title: "Caminho de fé", artist: "Artista a confirmar", technique: "Técnica mista", dimensions: "70 × 50 cm", status: "available", palette: "navy" },
  { id: 3, code: "OB-003", title: "Santo silêncio", artist: "Artista a confirmar", technique: "Acrílica sobre tela", dimensions: "90 × 70 cm", status: "reserved", palette: "wine" },
  { id: 4, code: "OB-004", title: "Jardim interior", artist: "Artista a confirmar", technique: "Óleo sobre tela", dimensions: "60 × 60 cm", status: "available", palette: "garden" },
  { id: 5, code: "OB-005", title: "Entre arcos", artist: "Artista a confirmar", technique: "Técnica mista", dimensions: "100 × 70 cm", status: "sold", palette: "arches" },
  { id: 6, code: "OB-006", title: "Vigília", artist: "Artista a confirmar", technique: "Acrílica sobre tela", dimensions: "80 × 80 cm", status: "available", palette: "night" },
];

const statusLabel = {
  available: "Disponível",
  reserved: "Reservada",
  sold: "Adquirida",
};

export function Catalog() {
  const [works, setWorks] = useState<Artwork[]>(fallbackWorks);
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">("all");
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/artworks?select=id,code,title,artist,technique,dimensions,status,palette&order=id.asc`, {
      headers: supabaseHeaders,
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: Artwork[]) => setWorks(data))
      .catch(() => undefined);
  }, []);

  const visibleWorks = useMemo(() => {
    if (filter === "available") return works.filter((work) => work.status === "available");
    if (filter === "unavailable") return works.filter((work) => work.status !== "available");
    return works;
  }, [filter, works]);

  const availableCount = works.filter((work) => work.status === "available").length;

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_artwork`, {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify({
          artwork_id: selected.id,
          reserver_name: form.get("name"),
          reserver_email: form.get("email"),
          reserver_phone: form.get("phone"),
        }),
      });
      const data = await response.json() as Artwork[] | { message?: string };
      const artwork = Array.isArray(data) ? data[0] : undefined;
      if (!response.ok || !artwork) {
        const detail = !Array.isArray(data) ? data.message : undefined;
        throw new Error(detail?.includes("acabou de ser reservada") ? detail : "Não foi possível reservar. Tente novamente.");
      }
      setWorks((current) => current.map((work) => work.id === artwork.id ? artwork : work));
      setMessage("Obra reservada. A equipe entrará em contato para concluir a aquisição.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setMessage("");
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
          <a href="#como-comprar">Como adquirir</a>
          <a href="#contato">Fale conosco</a>
        </nav>
        <a className="header-cta" href="#acervo">Ver acervo</a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-image" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow">Um evento da Basílica Santo Antônio</p>
          <h1>Arte que preserva<br />histórias.</h1>
          <p>
            Quase 60 obras reunidas em uma noite especial de arte,
            encontro e contribuição para o futuro da nossa Basílica.
          </p>
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
        <p className="intro-copy">
          O evento reúne obras únicas disponibilizadas em benefício da Basílica.
          Parte do acervo será adquirida durante a noite de 10 de setembro. As obras
          remanescentes continuarão disponíveis neste portal por mais sete dias.
        </p>
        <div className="numbers">
          <div><strong>~60</strong><span>obras selecionadas</span></div>
          <div><strong>10.09</strong><span>evento no hotel</span></div>
          <div><strong>17.09</strong><span>encerramento online</span></div>
        </div>
      </section>

      <section className="catalog-section" id="acervo">
        <div className="catalog-heading">
          <div>
            <p className="section-kicker">Acervo 2026</p>
            <h2>Obras disponíveis</h2>
            <p>{availableCount} de {works.length} obras desta prévia ainda disponíveis.</p>
          </div>
          <div className="filters" aria-label="Filtrar obras">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button>
            <button className={filter === "available" ? "active" : ""} onClick={() => setFilter("available")}>Disponíveis</button>
            <button className={filter === "unavailable" ? "active" : ""} onClick={() => setFilter("unavailable")}>Reservadas e adquiridas</button>
          </div>
        </div>

        <div className="works-grid" aria-live="polite">
          {visibleWorks.map((work) => (
            <article className={`work-card ${work.status !== "available" ? "unavailable" : ""}`} key={work.id}>
              <div className={`work-image ${work.palette}`}>
                <span className={`status ${work.status}`}>{statusLabel[work.status]}</span>
                <div className="art-shape shape-one" />
                <div className="art-shape shape-two" />
                {work.status !== "available" && <div className="sold-overlay"><strong>{statusLabel[work.status]}</strong><span>Esta obra não está mais disponível no acervo.</span></div>}
              </div>
              <div className="work-body">
                <span className="work-code">{work.code}</span>
                <h3>{work.title}</h3>
                <p>{work.artist}</p>
                <dl>
                  <div><dt>Técnica</dt><dd>{work.technique}</dd></div>
                  <div><dt>Dimensões</dt><dd>{work.dimensions}</dd></div>
                  <div><dt>Valor</dt><dd>Sob consulta</dd></div>
                </dl>
                <button disabled={work.status !== "available"} onClick={() => setSelected(work)}>
                  {work.status === "available" ? "Solicitar aquisição" : statusLabel[work.status]}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="como-comprar">
        <div>
          <p className="section-kicker light">Como adquirir</p>
          <h2>Escolha uma obra.<br />Nós cuidamos do restante.</h2>
        </div>
        <ol>
          <li><span>01</span><div><strong>Escolha</strong><p>Explore o acervo e selecione uma obra disponível.</p></div></li>
          <li><span>02</span><div><strong>Reserve</strong><p>Envie seus dados para retirar a unidade do acervo temporariamente.</p></div></li>
          <li><span>03</span><div><strong>Conclua</strong><p>A equipe da Basílica entrará em contato com as orientações de pagamento e retirada.</p></div></li>
        </ol>
      </section>

      <section className="closing" id="contato">
        <img src={BASILICA_CREST} alt="" />
        <p className="section-kicker">10 de setembro de 2026</p>
        <h2>Faça parte desta história.</h2>
        <p>O catálogo final receberá as fotografias, autorias, valores e detalhes de cada obra antes do evento.</p>
        <a className="button primary" href="mailto:santoantoniobasilica@gmail.com?subject=Evento%20Arte%20pela%20Basílica">Falar com a Basílica <span>→</span></a>
      </section>

      <footer>
        <div className="brand footer-brand">
          <img src={BASILICA_CREST} alt="" />
          <span><strong>Basílica</strong><small>Santo Antônio</small></span>
        </div>
        <p>Arte pela Basílica · Edição 2026</p>
        <p>Acervo online até 17 de setembro de 2026</p>
      </footer>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <section className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
            <button className="modal-close" onClick={closeModal} aria-label="Fechar">×</button>
            <p className="section-kicker">Solicitação de aquisição</p>
            <h2 id="purchase-title">{selected.title}</h2>
            <p className="modal-note">
              Ao enviar, esta obra ficará reservada e sairá da lista de disponíveis.
              A aquisição será concluída diretamente com a equipe da Basílica.
            </p>
            {message ? (
              <div className="success-message">
                <span>✓</span><p>{message}</p>
                <button onClick={closeModal}>Voltar ao acervo</button>
              </div>
            ) : (
              <form onSubmit={submitReservation}>
                <label>Nome completo<input name="name" required autoComplete="name" /></label>
                <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
                <label>WhatsApp<input name="phone" type="tel" required autoComplete="tel" /></label>
                <button className="button primary" disabled={submitting}>{submitting ? "Reservando…" : "Confirmar reserva"} <span>→</span></button>
                <small>Nenhuma cobrança é feita nesta etapa.</small>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
