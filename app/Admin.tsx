"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { publicAsset } from "./publicAsset";
import { supabase } from "./supabase";

const BASILICA_CREST = publicAsset("/logo-basilica.jpeg");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type IntentStatus = "reserved" | "submitted" | "reviewed" | "approved" | "declined" | "paid" | "expired";
type IntentItem = { artwork_id: number; artwork_code: string; artwork_title: string; artwork_status: "available" | "reserved" | "sold"; amount_cents: number };
type Intent = { id: string; bidder_name: string; bidder_email: string; bidder_phone: string; preferred_payment_method: string; total_cents: number; status: IntentStatus; created_at: string; expires_at: string | null; confirmation_code: string | null; extra_contribution_cents: number; items: IntentItem[] };
type ArtworkPrice = { id: number; code: string; title: string; price_cents: number | null; status: "available" | "reserved" | "sold" };
type PersonGroup = { key: string; name: string; email: string; phone: string; intents: Intent[]; items: IntentItem[]; total_cents: number; latest_at: string; activeCount: number };

const statusLabels: Record<IntentStatus, string> = { reserved: "Pré-reservada", submitted: "Nova", reviewed: "Em atendimento", approved: "Confirmada", declined: "Cancelada", paid: "Concluída", expired: "Expirada" };
const statusFilters: Array<{ value: "all" | IntentStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "reserved", label: "Pré-reservadas" },
  { value: "submitted", label: "Novas" },
  { value: "reviewed", label: "Em atendimento" },
  { value: "approved", label: "Confirmadas" },
  { value: "paid", label: "Concluídas" },
  { value: "declined", label: "Canceladas" },
];
const statusActions: Record<IntentStatus, Array<{ status: IntentStatus; label: string }>> = {
  reserved: [{ status: "reviewed", label: "Iniciar atendimento" }, { status: "approved", label: "Confirmar venda" }, { status: "declined", label: "Cancelar" }],
  submitted: [{ status: "reviewed", label: "Iniciar atendimento" }, { status: "approved", label: "Confirmar venda" }, { status: "declined", label: "Cancelar" }],
  reviewed: [{ status: "approved", label: "Confirmar venda" }, { status: "declined", label: "Cancelar" }],
  approved: [{ status: "paid", label: "Marcar como concluída" }, { status: "declined", label: "Cancelar confirmação" }],
  declined: [], paid: [], expired: [],
};

function cleanAdminUrl() { if (window.location.search || window.location.hash.includes("access_token=")) window.history.replaceState({}, "", `${window.location.pathname}#admin`); }

function formatPriceDraft(cents: number | null) {
  return cents === null ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

function normalizePriceDraft(value: string) {
  const cleaned = value.replace(/[^\d,.]/g, "");
  const decimalSeparator = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  if (decimalSeparator < 0) return cleaned.replace(/\D/g, "");
  const reais = cleaned.slice(0, decimalSeparator).replace(/\D/g, "");
  const centavos = cleaned.slice(decimalSeparator + 1).replace(/\D/g, "").slice(0, 2);
  return `${reais},${centavos}`;
}

function priceDraftToCents(value: string) {
  const normalized = normalizePriceDraft(value);
  if (!/^\d+(?:,\d{0,2})?$/.test(normalized)) return null;
  const [reais, centavos = ""] = normalized.split(",");
  const cents = Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 100 ? cents : null;
}

function groupByPerson(intents: Intent[]): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  intents.forEach((intent) => {
    const key = intent.bidder_email.trim().toLowerCase() || intent.bidder_phone.replace(/\D/g, "");
    const current = groups.get(key) ?? { key, name: intent.bidder_name, email: intent.bidder_email, phone: intent.bidder_phone, intents: [], items: [], total_cents: 0, latest_at: intent.created_at, activeCount: 0 };
    current.intents.push(intent);
    current.items.push(...intent.items);
    if (intent.status !== "declined" && intent.status !== "expired") { current.total_cents += intent.total_cents; current.activeCount += 1; }
    if (new Date(intent.created_at) > new Date(current.latest_at)) current.latest_at = intent.created_at;
    groups.set(key, current);
  });
  groups.forEach((group) => group.intents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  return [...groups.values()].sort((a, b) => {
    if (Boolean(a.activeCount) !== Boolean(b.activeCount)) return a.activeCount ? -1 : 1;
    return new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime();
  });
}

export function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [changingId, setChangingId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IntentStatus>("all");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [artworkPrices, setArtworkPrices] = useState<ArtworkPrice[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const togglePersonOpen = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadProposals = useCallback(async () => {
    setLoading(true); setNotice("");
    const { data, error } = await supabase.rpc("admin_get_proposals");
    if (error) { setIntents([]); setNotice("Não foi possível carregar as intenções. Atualize a página ou solicite um novo acesso."); }
    else setIntents((data ?? []) as Intent[]);
    const { data: prices } = await supabase.from("artworks").select("id,code,title,price_cents,status").order("id");
    if (prices) setArtworkPrices(prices as ArtworkPrice[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (!active) return; setSession(data.session); setAuthorized(data.session ? null : false); setAuthReady(true); if (data.session) cleanAdminUrl(); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (!active) return; setSession(nextSession); setAuthorized(nextSession ? null : false); setAuthReady(true); if (nextSession) cleanAdminUrl(); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    supabase.rpc("is_basilica_admin").then(({ data, error }) => {
      if (!active) return;
      setAuthorized(!error && data === true);
    });
    return () => { active = false; };
  }, [session]);
  useEffect(() => {
    if (authorized !== true) return;
    const timer = window.setTimeout(() => void loadProposals(), 0);
    return () => window.clearTimeout(timer);
  }, [authorized, loadProposals]);
  async function login(event: FormEvent) {
    event.preventDefault(); setLoading(true); setNotice("");
    const email = username.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setNotice(error ? "Usuário ou senha incorretos." : "Acesso autorizado.");
    if (!error) setPassword("");
    setLoading(false);
  }

  async function logout() {
    setLoading(true); await supabase.auth.signOut(); setSession(null); setAuthorized(false); setIntents([]); setLoading(false); window.history.replaceState({}, "", `${window.location.pathname}#admin`);
  }

  async function updateStatus(intent: Intent, nextStatus: IntentStatus) {
    const destructive = nextStatus === "approved" || nextStatus === "declined";
    if (destructive && !window.confirm(nextStatus === "approved" ? "Confirmar esta venda marcará as obras como adquiridas. Deseja continuar?" : "Confirma o cancelamento desta intenção?")) return;
    setChangingId(intent.id); setNotice("");
    const { error } = await supabase.rpc("admin_update_cart_status", { cart_id: intent.id, new_status: nextStatus });
    if (error) setNotice(error.message || "Não foi possível atualizar o status."); else { await loadProposals(); setNotice(`Status atualizado para “${statusLabels[nextStatus]}”.`); }
    setChangingId("");
  }

  async function updateArtworkPrice(artwork: ArtworkPrice) {
    const value = priceDrafts[artwork.id] ?? formatPriceDraft(artwork.price_cents);
    const cents = priceDraftToCents(value);
    if (cents === null) { setNotice("Informe um valor válido, usando vírgula para os centavos. Exemplo: 520,50."); return; }
    setChangingId(`price-${artwork.id}`); setNotice("");
    const { error } = await supabase.rpc("admin_update_artwork_price", { artwork_id: artwork.id, new_price_cents: cents });
    if (error) setNotice(error.message || "Não foi possível salvar o valor.");
    else { setPriceDrafts((drafts) => ({ ...drafts, [artwork.id]: formatPriceDraft(cents) })); await loadProposals(); setNotice(`Valor de ${artwork.title} atualizado.`); }
    setChangingId("");
  }

  async function makeArtworkAvailable(artwork: ArtworkPrice) {
    if (artwork.status === "available") return;
    const confirmed = window.confirm(`${artwork.title} voltará a aparecer como disponível no acervo. O histórico de reservas e vendas será preservado. Deseja continuar?`);
    if (!confirmed) return;
    setChangingId(`availability-${artwork.id}`); setNotice("");
    const { error } = await supabase.rpc("admin_set_artwork_available", { artwork_id: artwork.id });
    if (error) setNotice(error.message || "Não foi possível liberar a obra.");
    else { await loadProposals(); setNotice(`${artwork.title} voltou a ficar disponível.`); }
    setChangingId("");
  }

  const displayedIntents = intents;
  const filteredIntents = useMemo(() => statusFilter === "all" ? displayedIntents : displayedIntents.filter((intent) => intent.status === statusFilter), [displayedIntents, statusFilter]);
  const people = useMemo(() => groupByPerson(filteredIntents), [filteredIntents]);
  const allPeople = useMemo(() => groupByPerson(displayedIntents), [displayedIntents]);
  const activeIntents = displayedIntents.filter((intent) => intent.status !== "declined" && intent.status !== "expired");
  const confirmedIntents = displayedIntents.filter((intent) => intent.status === "approved" || intent.status === "paid");
  const activeTotal = activeIntents.reduce((sum, intent) => sum + intent.total_cents, 0);
  const confirmedTotal = confirmedIntents.reduce((sum, intent) => sum + intent.total_cents, 0);
  const statusCount = useCallback((status: "all" | IntentStatus) => status === "all" ? displayedIntents.length : displayedIntents.filter((intent) => intent.status === status).length, [displayedIntents]);

  let content;
  if (!authReady || (session && authorized === null)) content = <p className="admin-notice">Verificando acesso seguro…</p>;
  else if (!session) content = <div className="admin-login"><p className="section-kicker">Área restrita</p><h1>Acesso administrativo</h1><p>Use as credenciais administrativas fornecidas à equipe responsável.</p><form className="admin-auth-form" onSubmit={login}><label>E-mail<input name="username" type="email" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Senha<input name="password" type="password" required minLength={16} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite a senha administrativa" /></label><button className="button primary" disabled={loading}>{loading ? "Entrando…" : "Entrar no painel"}<span className="arrow-icon arrow-right" aria-hidden="true" /></button></form>{notice && <p className="admin-notice" role="status">{notice}</p>}</div>;
  else if (!authorized) content = <div className="admin-login"><p className="section-kicker">Acesso negado</p><h1>Conta não autorizada</h1><p>Esta conta não possui permissão para consultar dados administrativos.</p><button className="button primary" onClick={logout}>Sair desta conta <span className="arrow-icon arrow-right" aria-hidden="true" /></button></div>;
  else content = <div className="admin-dashboard">
    <div className="admin-title"><div><p className="section-kicker">Painel administrativo</p><h1>Intenções por pessoa</h1><p>Cada pessoa reúne seus pedidos, obras selecionadas e valor total para atendimento presencial.</p></div><button className="admin-refresh" onClick={loadProposals} disabled={loading}>{loading ? "Atualizando…" : "Atualizar dados"}</button></div>
    <section className="admin-overview" aria-labelledby="overview-title"><div className="admin-section-heading"><div><span className="admin-section-index">01</span><div><p>Visão geral</p><h2 id="overview-title">Resumo operacional</h2></div></div><small>Atualizado sob demanda</small></div><div className="admin-stats"><div><span>Pessoas interessadas</span><strong>{allPeople.length}</strong><small>Contatos únicos</small></div><div><span>Intenções ativas</span><strong>{activeIntents.length}</strong><small>Aguardando conclusão</small></div><div><span>Valor em atendimento</span><strong>{money.format(activeTotal / 100)}</strong><small>Intenções não canceladas</small></div><div><span>Confirmado / concluído</span><strong>{money.format(confirmedTotal / 100)}</strong><small>Vendas confirmadas</small></div></div></section>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-queue" aria-labelledby="queue-title"><div className="admin-section-heading queue-heading"><div><span className="admin-section-index">02</span><div><p>Organização por pessoa</p><h2 id="queue-title">Fila de atendimento</h2></div></div><small>{people.length} {people.length === 1 ? "pessoa neste filtro" : "pessoas neste filtro"}</small></div>
    <div className="admin-toolbar" aria-label="Filtrar intenções por status">{statusFilters.map((filter) => <button type="button" key={filter.value} className={statusFilter === filter.value ? "active" : ""} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)}><span>{filter.label}</span><b>{statusCount(filter.value)}</b></button>)}</div>
    {loading && !displayedIntents.length ? <p className="admin-notice">Carregando registros…</p> : <div className="people-list" tabIndex={people.length > 4 ? 0 : undefined} aria-label="Pessoas na fila de atendimento">{people.length ? people.map((person) => <details className="person-card" key={person.key} open={openKeys.has(person.key)}>
      <summary className="person-summary" onClick={(e) => { e.preventDefault(); togglePersonOpen(person.key); }}>
        <span className="person-avatar" aria-hidden="true">{person.name.charAt(0).toUpperCase()}</span>
        <span className="person-identity"><span className="person-label">Pessoa interessada</span><strong>{person.name}</strong><small>{person.items.length} {person.items.length === 1 ? "obra selecionada" : "obras selecionadas"} · Atualizado em {new Date(person.latest_at).toLocaleDateString("pt-BR")}</small></span>
        <span className="person-total"><span>Valor total ativo</span><strong>{money.format(person.total_cents / 100)}</strong><small>{person.activeCount} {person.activeCount === 1 ? "intenção ativa" : "intenções ativas"}</small></span>
        <span className="person-expand" aria-hidden="true"><b>{openKeys.has(person.key) ? "Ocultar detalhes" : "Ver detalhes"}</b><i /></span>
      </summary>
      <div className="person-body">
        <div className="person-contact-panel"><div><span>Contato direto</span><strong>{person.name}</strong></div><div className="intent-contact"><a href={`tel:${person.phone}`}><small>Telefone</small><b>{person.phone}</b></a><a href={`mailto:${person.email}`}><small>E-mail</small><b>{person.email}</b></a></div></div>
        <div className="person-intents-head"><span>Histórico de intenções</span><small>{person.intents.length} {person.intents.length === 1 ? "registro" : "registros"}</small></div>
        <div className="person-intents" tabIndex={person.intents.length > 2 ? 0 : undefined} aria-label={`Histórico de intenções de ${person.name}`}>{person.intents.map((intent, index) => <section className="intent-group" key={intent.id}><div className="intent-group-head"><div><span className="intent-number">Pré-reserva {intent.confirmation_code || String(index + 1).padStart(2, "0")}</span><span className={`intent-status ${intent.status}`}>{statusLabels[intent.status]}</span><time>{new Date(intent.created_at).toLocaleString("pt-BR")}{intent.expires_at ? ` · expira ${new Date(intent.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</time></div><strong>{money.format(intent.total_cents / 100)}</strong></div><ul>{intent.items.map((item) => <li key={`${intent.id}-${item.artwork_id}`}><span><small>{item.artwork_code}</small><b>{item.artwork_title}</b></span><strong>{money.format(item.amount_cents / 100)}</strong></li>)}</ul>{intent.extra_contribution_cents > 0 && <p className="intent-extra-offer">Oferta adicional: <strong>{money.format(intent.extra_contribution_cents / 100)}</strong></p>}{statusActions[intent.status].length > 0 && <div className="intent-actions" aria-label={`Ações para intenção de ${person.name}`}>{statusActions[intent.status].map((action) => <button key={action.status} className={action.status} disabled={changingId === intent.id} onClick={() => updateStatus(intent, action.status)}>{changingId === intent.id ? "Salvando…" : action.label}</button>)}</div>}</section>)}</div>
      </div>
    </details>) : <p className="admin-notice empty-state">Nenhuma intenção encontrada neste filtro.</p>}</div>}</section>
    <section className="admin-pricing" aria-labelledby="pricing-title"><div className="admin-section-heading"><div><span className="admin-section-index">03</span><div><p>Obras e valores</p><h2 id="pricing-title">Controle do acervo</h2></div></div><small>Atualizações aparecem imediatamente no catálogo</small></div><div className="admin-price-grid">{artworkPrices.map((artwork) => <article key={artwork.id}><span><b>{artwork.code}</b><small className={`artwork-admin-status ${artwork.status}`}>{artwork.status === "available" ? "Disponível" : artwork.status === "reserved" ? "Pré-reservada" : "Adquirida"}</small></span><label><span className="sr-only">Valor padrão de {artwork.title}</span><div><i>R$</i><input inputMode="decimal" maxLength={15} value={priceDrafts[artwork.id] ?? formatPriceDraft(artwork.price_cents)} onChange={(event) => setPriceDrafts((drafts) => ({ ...drafts, [artwork.id]: normalizePriceDraft(event.target.value) }))} aria-label={`Valor padrão de ${artwork.title}`} placeholder="0,00" /><button type="button" disabled={changingId === `price-${artwork.id}`} onClick={() => updateArtworkPrice(artwork)}>{changingId === `price-${artwork.id}` ? "…" : "Salvar"}</button></div></label><button className={`artwork-availability-action ${artwork.status}`} type="button" disabled={artwork.status === "available" || changingId === `availability-${artwork.id}`} onClick={() => makeArtworkAvailable(artwork)}>{changingId === `availability-${artwork.id}` ? "Liberando…" : artwork.status === "available" ? "Já disponível" : "Tornar disponível"}</button></article>)}</div></section>
  </div>;

  return <main className="admin-page"><header className="admin-header"><a className="admin-back" href="#conteudo-principal"><span className="arrow-icon arrow-left" aria-hidden="true" /><span>Voltar à exposição</span></a><a className="admin-brand" href="#conteudo-principal" aria-label="Arte pela Basílica — voltar à exposição"><span className="admin-brand-crest"><img src={BASILICA_CREST} alt="" /></span><span><small>Vernissage 2026</small><strong>Arte pela Basílica</strong></span></a><div className="admin-header-actions"><span>Gestão presencial</span>{session && <button onClick={logout}>Sair</button>}</div></header><section className="admin-wrap">{content}</section></main>;
}
