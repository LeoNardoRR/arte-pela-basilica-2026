"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_EMAIL, supabase } from "./supabase";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
type IntentStatus = "submitted" | "reviewed" | "approved" | "declined" | "paid";
type IntentItem = { artwork_id: number; artwork_code: string; artwork_title: string; artwork_status: "available" | "reserved" | "sold"; amount_cents: number };
type Intent = { id: string; bidder_name: string; bidder_email: string; bidder_phone: string; preferred_payment_method: string; total_cents: number; status: IntentStatus; created_at: string; items: IntentItem[] };
type PersonGroup = { key: string; name: string; email: string; phone: string; intents: Intent[]; items: IntentItem[]; total_cents: number; latest_at: string; activeCount: number };

const statusLabels: Record<IntentStatus, string> = { submitted: "Nova", reviewed: "Em atendimento", approved: "Confirmada", declined: "Cancelada", paid: "Concluída" };
const statusActions: Record<IntentStatus, Array<{ status: IntentStatus; label: string }>> = {
  submitted: [{ status: "reviewed", label: "Iniciar atendimento" }, { status: "approved", label: "Confirmar venda" }, { status: "declined", label: "Cancelar" }],
  reviewed: [{ status: "approved", label: "Confirmar venda" }, { status: "declined", label: "Cancelar" }],
  approved: [{ status: "paid", label: "Marcar como concluída" }, { status: "declined", label: "Cancelar confirmação" }],
  declined: [], paid: [],
};

function authRedirectUrl() { const redirect = new URL(window.location.origin); redirect.search = "?admin=1"; return redirect.toString(); }
function cleanAdminUrl() { if (window.location.search || window.location.hash.includes("access_token=")) window.history.replaceState({}, "", `${window.location.pathname}#admin`); }
function resetButtonLabel(seconds: number) { return seconds >= 60 ? `Reenviar em ${Math.ceil(seconds / 60)} min` : `Reenviar em ${seconds}s`; }

function groupByPerson(intents: Intent[]): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  intents.forEach((intent) => {
    const key = intent.bidder_email.trim().toLowerCase() || intent.bidder_phone.replace(/\D/g, "");
    const current = groups.get(key) ?? { key, name: intent.bidder_name, email: intent.bidder_email, phone: intent.bidder_phone, intents: [], items: [], total_cents: 0, latest_at: intent.created_at, activeCount: 0 };
    current.intents.push(intent);
    current.items.push(...intent.items);
    if (intent.status !== "declined") { current.total_cents += intent.total_cents; current.activeCount += 1; }
    if (new Date(intent.created_at) > new Date(current.latest_at)) current.latest_at = intent.created_at;
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime());
}

export function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [changingId, setChangingId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IntentStatus>("all");
  const [username, setUsername] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(() => typeof window !== "undefined" && window.location.hash.includes("type=recovery"));
  const [resetCooldown, setResetCooldown] = useState(0);
  const authorized = session?.user.email?.toLowerCase() === ADMIN_EMAIL;

  const loadProposals = useCallback(async () => {
    setLoading(true); setNotice("");
    const { data, error } = await supabase.rpc("admin_get_proposals");
    if (error) { setIntents([]); setNotice("Não foi possível carregar as intenções. Atualize a página ou solicite um novo acesso."); }
    else setIntents((data ?? []) as Intent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (!active) return; setSession(data.session); setAuthReady(true); if (data.session) cleanAdminUrl(); });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => { if (!active) return; setSession(nextSession); setAuthReady(true); if (event === "PASSWORD_RECOVERY") setRecoveryMode(true); if (nextSession) cleanAdminUrl(); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const timer = window.setTimeout(() => void loadProposals(), 0);
    return () => window.clearTimeout(timer);
  }, [authorized, loadProposals]);
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => setResetCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  async function login(event: FormEvent) {
    event.preventDefault(); setLoading(true); setNotice("");
    const email = username.trim().toLowerCase();
    if (email !== ADMIN_EMAIL) { setNotice("Usuário ou senha incorretos."); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setNotice(error ? "Usuário ou senha incorretos." : "Acesso autorizado.");
    if (!error) setPassword("");
    setLoading(false);
  }

  async function requestPasswordReset() {
    if (resetCooldown > 0) return;
    setLoading(true); setNotice("");
    if (username.trim().toLowerCase() !== ADMIN_EMAIL) { setNotice("Informe o usuário administrador cadastrado."); setLoading(false); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: authRedirectUrl() });
    const shortWait = Boolean(error && /after \d+ seconds/i.test(error.message));
    setResetCooldown(error && !shortWait ? 3600 : 60);
    setNotice(error ? (shortWait ? "O e-mail foi solicitado há pouco. Aguarde 1 minuto antes de tentar novamente." : "O limite temporário de 2 e-mails por hora foi atingido. Aguarde até 1 hora e tente novamente.") : `Enviamos para ${ADMIN_EMAIL} o link seguro. Abra o e-mail mais recente e toque em “Redefinir senha”.`);
    setLoading(false);
  }

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("new-password") || "");
    const confirmation = String(form.get("confirm-password") || "");
    if (newPassword.length < 8) { setNotice("A senha precisa ter pelo menos 8 caracteres."); setLoading(false); return; }
    if (newPassword !== confirmation) { setNotice("As duas senhas precisam ser iguais."); setLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setNotice("Não foi possível salvar a senha. Solicite um novo link e tente novamente.");
    else { setRecoveryMode(false); setNotice("Senha criada com sucesso. Seu painel já está liberado."); cleanAdminUrl(); }
    setLoading(false);
  }

  async function logout() {
    setLoading(true); await supabase.auth.signOut(); setSession(null); setIntents([]); setLoading(false); window.history.replaceState({}, "", `${window.location.pathname}#admin`);
  }

  async function updateStatus(intent: Intent, nextStatus: IntentStatus) {
    const destructive = nextStatus === "approved" || nextStatus === "declined";
    if (destructive && !window.confirm(nextStatus === "approved" ? "Confirmar esta venda marcará as obras como adquiridas. Deseja continuar?" : "Confirma o cancelamento desta intenção?")) return;
    setChangingId(intent.id); setNotice("");
    const { error } = await supabase.rpc("admin_update_cart_status", { cart_id: intent.id, new_status: nextStatus });
    if (error) setNotice(error.message || "Não foi possível atualizar o status."); else { await loadProposals(); setNotice(`Status atualizado para “${statusLabels[nextStatus]}”.`); }
    setChangingId("");
  }

  const displayedIntents = intents;
  const filteredIntents = useMemo(() => statusFilter === "all" ? displayedIntents : displayedIntents.filter((intent) => intent.status === statusFilter), [displayedIntents, statusFilter]);
  const people = useMemo(() => groupByPerson(filteredIntents), [filteredIntents]);
  const allPeople = useMemo(() => groupByPerson(displayedIntents), [displayedIntents]);
  const activeIntents = displayedIntents.filter((intent) => intent.status !== "declined");
  const confirmedIntents = displayedIntents.filter((intent) => intent.status === "approved" || intent.status === "paid");
  const activeTotal = activeIntents.reduce((sum, intent) => sum + intent.total_cents, 0);
  const confirmedTotal = confirmedIntents.reduce((sum, intent) => sum + intent.total_cents, 0);

  let content;
  if (!authReady) content = <p className="admin-notice">Verificando acesso seguro…</p>;
  else if (recoveryMode && session) content = <div className="admin-login"><p className="section-kicker">Primeiro acesso ou recuperação</p><h1>Crie sua nova senha</h1><p>Escolha uma senha com pelo menos 8 caracteres para proteger o painel administrativo.</p><form className="admin-auth-form" onSubmit={saveNewPassword}><label>Nova senha<input name="new-password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /></label><label>Confirmar senha<input name="confirm-password" type="password" required minLength={8} autoComplete="new-password" placeholder="Digite novamente" /></label><button className="button primary" disabled={loading}>{loading ? "Salvando…" : "Salvar senha e acessar"}<span>→</span></button></form>{notice && <p className="admin-notice" role="status">{notice}</p>}</div>;
  else if (!session) content = <div className="admin-login"><p className="section-kicker">Área restrita</p><h1>Acesso administrativo</h1><p>Entre com o usuário e a senha da equipe para consultar e administrar as intenções de compra.</p><form className="admin-auth-form" onSubmit={login}><label>Usuário<input name="username" type="email" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="seu@email.com" /></label><label>Senha<input name="password" type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" /></label><button className="button primary" disabled={loading}>{loading ? "Entrando…" : "Entrar no painel"}<span>→</span></button><button type="button" className="password-reset-button" onClick={requestPasswordReset} disabled={loading || resetCooldown > 0}>{resetCooldown > 0 ? resetButtonLabel(resetCooldown) : "Criar ou redefinir senha"}</button></form>{notice && <p className="admin-notice" role="status">{notice}</p>}</div>;
  else if (!authorized) content = <div className="admin-login"><p className="section-kicker">Acesso negado</p><h1>Conta não autorizada</h1><p>Esta conta não possui permissão para consultar dados administrativos.</p><button className="button primary" onClick={logout}>Sair desta conta <span>→</span></button></div>;
  else content = <div>
    <div className="admin-title"><div><p className="section-kicker">Painel administrativo</p><h1>Intenções por pessoa</h1><p>Cada pessoa reúne seus pedidos, obras selecionadas e valor total para atendimento presencial.</p></div><button className="admin-refresh" onClick={loadProposals} disabled={loading}>{loading ? "Atualizando…" : "Atualizar dados"}</button></div>
    <div className="admin-stats"><div><span>Pessoas interessadas</span><strong>{allPeople.length}</strong></div><div><span>Intenções ativas</span><strong>{activeIntents.length}</strong></div><div><span>Valor em atendimento</span><strong>{money.format(activeTotal / 100)}</strong></div><div><span>Confirmado/concluído</span><strong>{money.format(confirmedTotal / 100)}</strong></div></div>
    <div className="admin-toolbar"><label htmlFor="status-filter">Filtrar por status</label><select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | IntentStatus)}><option value="all">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {loading && !displayedIntents.length ? <p className="admin-notice">Carregando registros…</p> : <div className="people-list">{people.length ? people.map((person) => <article className="person-card" key={person.key}><header className="person-head"><div className="person-avatar" aria-hidden="true">{person.name.charAt(0).toUpperCase()}</div><div><span className="person-label">Pessoa interessada</span><h2>{person.name}</h2><div className="intent-contact"><a href={`tel:${person.phone}`}>{person.phone}</a><a href={`mailto:${person.email}`}>{person.email}</a></div></div><div className="person-total"><span>Valor total ativo</span><strong>{money.format(person.total_cents / 100)}</strong><small>{person.activeCount} {person.activeCount === 1 ? "intenção ativa" : "intenções ativas"}</small></div></header><div className="person-intents">{person.intents.map((intent) => <section className="intent-group" key={intent.id}><div className="intent-group-head"><div><span className={`intent-status ${intent.status}`}>{statusLabels[intent.status]}</span><time>{new Date(intent.created_at).toLocaleString("pt-BR")}</time></div><strong>{money.format(intent.total_cents / 100)}</strong></div><ul>{intent.items.map((item) => <li key={`${intent.id}-${item.artwork_id}`}><span><b>{item.artwork_title}</b><small>{item.artwork_code}</small></span><strong>{money.format(item.amount_cents / 100)}</strong></li>)}</ul>{statusActions[intent.status].length > 0 && <div className="intent-actions" aria-label={`Ações para intenção de ${person.name}`}>{statusActions[intent.status].map((action) => <button key={action.status} className={action.status} disabled={changingId === intent.id} onClick={() => updateStatus(intent, action.status)}>{changingId === intent.id ? "Salvando…" : action.label}</button>)}</div>}</section>)}</div></article>) : <p className="admin-notice">Nenhuma intenção encontrada neste filtro.</p>}</div>}
  </div>;

  return <main className="admin-page"><header className="admin-header"><a href="#inicio">← Voltar à exposição</a><span>Arte pela Basílica · Gestão presencial</span>{session && <button onClick={logout}>Sair</button>}</header><section className="admin-wrap">{content}</section></main>;
}
