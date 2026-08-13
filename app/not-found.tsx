import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <img src="/logo-basilica.jpeg" alt="" />
      <p className="section-kicker">Página não encontrada</p>
      <h1>Este caminho não faz parte da exposição.</h1>
      <p>Volte ao início para conhecer o acervo Arte pela Basílica.</p>
      <Link className="button primary" href="/">Voltar à página inicial <span className="arrow-icon arrow-right" aria-hidden="true" /></Link>
    </main>
  );
}
