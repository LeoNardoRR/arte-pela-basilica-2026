import { FormEvent, useEffect, useMemo, useState } from "react";

const SUPABASE_URL = "https://luodxzttfbnnufxufehb.supabase.co";
const SUPABASE_KEY = "sb_publishable_rmXVP-5JoFt5xTF6humZPQ_oQAWLm2n";
const ADMIN_EMAIL = "bmoweb@gmail.com";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Intent = { id: string; bidder_name: string; bidder_email: string; bidder_phone: string; total_cents: number; status: string; created_at: string; auction_cart_items: Array<{ amount_cents: number; artworks: { code: string; title: string } | null }> };

function tokenFromHash() { return new URLSearchParams(window.location.hash.split("?")[1] || "").get("access_token") || ""; }

export function Admin() {
  const [token, setToken] = useState(tokenFromHash);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestAccess(event: FormEvent) {
    event.preventDefault(); setLoading(true); setNotice("");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN_EMAIL, options: { emailRedirectTo: `${window.location.origin}/#admin` } }) });
    setNotice(response.ok ? `Enviamos um link seguro para ${ADMIN_EMAIL}. Abra-o neste computador para acessar o painel.` : "Não foi possível enviar o link agora. Verifique a configuração de autenticação do projeto.");
    setLoading(false);
  }

  useEffect(() => {
    const newToken = tokenFromHash();
    if (newToken && newToken !== token) setToken(newToken);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${SUPABASE_URL}/rest/v1/auction_carts?select=id,bidder_name,bidder_email,bidder_phone,total_cents,status,created_at,auction_cart_items(amount_cents,artworks(code,title))&order=created_at.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: Intent[]) => setIntents(data))
      .catch(() => setNotice("Seu acesso não foi reconhecido. Abra novamente o link seguro recebido por e-mail."))
      .finally(() => setLoading(false));
  }, [token]);

  const total = useMemo(() => intents.reduce((sum, intent) => sum + intent.total_cents, 0), [intents]);
  function logout() { setToken(""); window.location.hash = "admin"; }

  const content = !token ? (
    <div className="admin-login"><p className="section-kicker">Área restrita</p><h1>Intenções de compra</h1><p>O acesso é exclusivo do administrador e usa um link seguro enviado para o seu e-mail.</p><form onSubmit={requestAccess}><button className="button primary" disabled={loading}>{loading ? "Enviando…" : "Enviar link de acesso"} <span>→</span></button></form>{notice && <p className="admin-notice">{notice}</p>}</div>
  ) : (
    <div><div className="admin-title"><div><p className="section-kicker">Painel administrativo</p><h1>Intenções registradas</h1></div><button className="admin-refresh" onClick={() => window.location.reload()}>Atualizar</button></div><div className="admin-stats"><div><span>Intenções</span><strong>{intents.length}</strong></div><div><span>Montante acumulado</span><strong>{money.format(total / 100)}</strong></div></div>{notice && <p className="admin-notice">{notice}</p>}{loading ? <p className="admin-notice">Carregando registros…</p> : <div className="intent-list">{intents.length ? intents.map((intent) => <article className="intent-card" key={intent.id}><div className="intent-top"><div><h2>{intent.bidder_name}</h2><p>{new Date(intent.created_at).toLocaleString("pt-BR")}</p></div><strong>{money.format(intent.total_cents / 100)}</strong></div><div className="intent-contact"><span>{intent.bidder_phone}</span><span>{intent.bidder_email}</span></div><ul>{intent.auction_cart_items.map((item, index) => <li key={index}>{item.artworks?.title || "Obra"} <small>{item.artworks?.code} · {money.format(item.amount_cents / 100)}</small></li>)}</ul></article>) : <p className="admin-notice">Nenhuma intenção registrada ainda.</p>}</div>}</div>
  );

  return <main className="admin-page"><header className="admin-header"><a href="#inicio">← Voltar ao site</a><span>Controle pessoal · Arte pela Basílica</span>{token && <button onClick={logout}>Sair</button>}</header><section className="admin-wrap">{content}</section></main>;
}
