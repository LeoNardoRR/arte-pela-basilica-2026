const BASILICA_CREST = "/logo-basilica.jpeg";

export default function Admin({ onBack }: { onBack: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--navy)", padding: "24px" }}>
      <section style={{ background: "white", padding: "40px", borderRadius: "14px", width: "min(480px, 100%)", textAlign: "center", boxShadow: "0 25px 80px rgba(0,0,0,.3)" }}>
        <img src={BASILICA_CREST} alt="" style={{ width: 60, height: 60, borderRadius: 8, marginBottom: 20 }} />
        <p className="section-kicker">Área restrita</p>
        <h1 style={{ color: "var(--navy)" }}>Acesso administrativo indisponível neste ambiente</h1>
        <p>O painel com dados pessoais funciona somente no ambiente privado e exige autenticação autorizada.</p>
        <button className="button primary" type="button" onClick={onBack}>Voltar ao catálogo</button>
      </section>
    </main>
  );
}
