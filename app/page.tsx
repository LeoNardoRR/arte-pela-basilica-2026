const works = [
  { number: "01", tone: "clay", title: "Luz que atravessa", type: "Pintura" },
  { number: "02", tone: "blue", title: "Entre o céu e a terra", type: "Técnica mista" },
  { number: "03", tone: "gold", title: "Silêncio dourado", type: "Pintura" },
  { number: "04", tone: "rose", title: "Jardim interior", type: "Pintura" },
  { number: "05", tone: "green", title: "Caminho de esperança", type: "Técnica mista" },
  { number: "06", tone: "night", title: "Vigília", type: "Pintura" },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Arte pela Basílica — início">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>Arte pela Basílica</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#evento">O evento</a>
          <a href="#obras">Obras</a>
          <a href="#proposito">Propósito</a>
        </nav>
        <a className="header-cta" href="#obras">Ver obras <span aria-hidden="true">↗</span></a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">Uma noite de arte em benefício da Basílica</p>
          <h1>Arte que<br />transforma.</h1>
          <p className="hero-text">
            Uma seleção especial de quase 60 obras reunidas para celebrar a beleza,
            a cultura e a preservação de um patrimônio que pertence a todos.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="#obras">Explorar o acervo <span>↓</span></a>
            <a className="text-link" href="#evento">Conheça o evento <span>↗</span></a>
          </div>
        </div>

        <div className="hero-art" aria-label="Composição artística abstrata em tons terrosos">
          <div className="sun" />
          <div className="arch arch-one" />
          <div className="arch arch-two" />
          <div className="hero-signature">edição<br /><strong>2026</strong></div>
          <p className="art-caption">Encontro entre arte,<br />memória e futuro.</p>
        </div>

        <aside className="date-card">
          <span className="date-number">10</span>
          <span className="date-month">setembro</span>
          <span className="date-year">2026</span>
          <div className="date-rule" />
          <p>Evento presencial<br />no hotel anfitrião</p>
        </aside>
      </section>

      <section className="availability" aria-label="Período de disponibilidade">
        <span className="pulse" aria-hidden="true" />
        <p><strong>As obras continuam disponíveis online por uma semana após o evento.</strong></p>
        <p>Catálogo aberto até 17 de setembro de 2026.</p>
      </section>

      <section className="event-section" id="evento">
        <div className="section-label"><span>01</span> O encontro</div>
        <div className="event-main">
          <p className="kicker">Arte, presença e legado</p>
          <h2>Uma noite para<br />ficar na memória.</h2>
        </div>
        <div className="event-copy">
          <p>
            No dia 10 de setembro, convidados, artistas e admiradores se encontram
            em uma experiência promovida pela Basílica. O hotel anfitrião recebe o
            evento e oferece toda a estrutura necessária para essa celebração.
          </p>
          <p>
            Parte das obras poderá ser adquirida durante a noite. As unidades
            remanescentes seguem disponíveis neste site até 17 de setembro.
          </p>
        </div>
        <div className="facts">
          <div><strong>~60</strong><span>obras selecionadas</span></div>
          <div><strong>01</strong><span>noite especial</span></div>
          <div><strong>07</strong><span>dias de catálogo online</span></div>
        </div>
      </section>

      <section className="works-section" id="obras">
        <div className="works-heading">
          <div>
            <div className="section-label light"><span>02</span> Seleção de obras</div>
            <h2>Descubra o<br /><em>acervo.</em></h2>
          </div>
          <p>
            Cada obra é uma unidade única. A seleção completa, com autoria, dimensões,
            técnica e disponibilidade, será publicada em breve.
          </p>
        </div>

        <div className="works-grid">
          {works.map((work) => (
            <article className="work-card" key={work.number}>
              <div className={`work-image ${work.tone}`}>
                <span className="work-number">Nº {work.number}</span>
                <div className="paint-shape" />
                <span className="preview-label">imagem ilustrativa</span>
              </div>
              <div className="work-meta">
                <div><h3>{work.title}</h3><p>{work.type} · Acervo 2026</p></div>
                <span aria-hidden="true">↗</span>
              </div>
            </article>
          ))}
        </div>
        <div className="catalog-note">
          <p>O catálogo definitivo será atualizado conforme a disponibilidade após o evento presencial.</p>
          <a href="#contato">Receber novidades <span>→</span></a>
        </div>
      </section>

      <section className="purpose-section" id="proposito">
        <div className="purpose-art" aria-hidden="true">
          <span className="halo" />
          <span className="purpose-cross">✦</span>
        </div>
        <div className="purpose-copy">
          <div className="section-label"><span>03</span> Nosso propósito</div>
          <p className="quote-mark">“</p>
          <h2>Quando a arte encontra um propósito, o que permanece é o legado.</h2>
          <p>
            Este é um evento da Basílica. Uma iniciativa que aproxima pessoas,
            valoriza a produção artística e contribui para preservar sua história
            para as próximas gerações.
          </p>
        </div>
      </section>

      <section className="closing" id="contato">
        <p className="eyebrow">10 de setembro de 2026</p>
        <h2>Faça parte<br />desta história.</h2>
        <p>Em breve, todas as informações sobre local, horário, obras e formas de aquisição.</p>
        <a className="button button-light" href="mailto:contato@exemplo.com?subject=Quero%20saber%20mais%20sobre%20o%20evento">
          Quero saber mais <span>↗</span>
        </a>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">✦</span><span>Arte pela Basílica</span></div>
        <p>Uma realização da Basílica<br />com apoio do hotel anfitrião.</p>
        <p className="footer-date">10 — 17 SET 2026</p>
      </footer>
    </main>
  );
}
