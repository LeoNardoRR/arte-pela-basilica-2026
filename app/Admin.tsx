"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_EMAIL, supabase } from "./supabase";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type IntentStatus = "submitted" | "reviewed" | "approved" | "declined" | "paid";

type IntentItem = {
  artwork_id: number;
  artwork_code: string;
  artwork_title: string;
  artwork_status: "available" | "reserved" | "sold";
  amount_cents: number;
};

type Intent = {
  id: string;
  bidder_name: string;
  bidder_email: string;
  bidder_phone: string;
  preferred_payment_method: string;
  total_cents: number;
  status: IntentStatus;
  created_at: string;
  items: IntentItem[];
};

const statusLabels: Record<IntentStatus, string> = {
  submitted: "Nova",
  reviewed: "Em análise",
  approved: "Aprovada",
  declined: "Recusada",
  paid: "Paga",
};

const statusActions: Record<IntentStatus, Array<{ status: IntentStatus; label: string }>> = {
  submitted: [
    { status: "reviewed", label: "Marcar em análise" },
    { status: "approved", label: "Aprovar" },
    { status: "declined", label: "Recusar" },
  ],
  reviewed: [
    { status: "approved", label: "Aprovar" },
    { status: "declined", label: "Recusar" },
  ],
  approved: [
    { status: "paid", label: "Marcar como paga" },
    { status: "declined", label: "Cancelar aprovação" },
  ],
  declined: [],
  paid: [],
};

const demoIntentsSeed: Intent[] = [
  {
    id: "demo-001",
    bidder_name: "Marina Oliveira (demonstração)",
    bidder_email: "marina.exemplo@demo.local",
    bidder_phone: "+55 11 90000-0001",
    preferred_payment_method: "in_person",
    total_cents: 425000,
    status: "submitted",
    created_at: "2026-08-09T14:30:00.000Z",
    items: [
      { artwork_id: 2, artwork_code: "OB-002", artwork_title: "Caminho de fé", artwork_status: "available", amount_cents: 275000 },
      { artwork_id: 4, artwork_code: "OB-004", artwork_title: "Jardim interior", artwork_status: "available", amount_cents: 150000 },
    ],
  },
  {
    id: "demo-002",
    bidder_name: "Carlos Santos (demonstração)",
    bidder_email: "carlos.exemplo@demo.local",
    bidder_phone: "+55 11 90000-0002",
    preferred_payment_method: "in_person",
    total_cents: 310000,
    status: "reviewed",
    created_at: "2026-08-08T18:10:00.000Z",
    items: [
      { artwork_id: 3, artwork_code: "OB-003", artwork_title: "Santo silêncio", artwork_status: "available", amount_cents: 310000 },
    ],
  },
  {
    id: "demo-003",
    bidder_name: "Ana Lima (demonstração)",
    bidder_email: "ana.exemplo@demo.local",
    bidder_phone: "+55 11 90000-0003",
    preferred_payment_method: "in_person",
    total_cents: 520000,
    status: "approved",
    created_at: "2026-08-07T11:20:00.000Z",
    items: [
      { artwork_id: 1, artwork_code: "OB-001", artwork_title: "Luz da manhã", artwork_status: "sold", amount_cents: 520000 },
    ],
  },
];

function authRedirectUrl() {
  const redirect = new URL(window.location.href);
  redirect.search = "?admin=1";
  redirect.hash = "";
  return redirect.toString();
}

function cleanAdminUrl() {
  if (window.location.search || window.location.hash.includes("access_token=")) {
    window.history.replaceState({}, "", `${window.location.pathname}#admin`);
  }
}

export function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [changingId, setChangingId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IntentStatus>("all");
  const [demoMode, setDemoMode] = useState(false);
  const [demoIntents, setDemoIntents] = useState<Intent[]>(demoIntentsSeed);

  const authorized = session?.user.email?.toLowerCase() === ADMIN_EMAIL;

  const loadProposals = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const { data, error } = await supabase.rpc("admin_get_proposals");

    if (error) {
      setIntents([]);
      setNotice("Não foi possível carregar as intenções. Atualize a página ou solicite um novo acesso.");
    } else {
      setIntents((data ?? []) as Intent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
      if (data.session) cleanAdminUrl();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession) cleanAdminUrl();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authorized) void loadProposals();
  }, [authorized, loadProposals]);

  async function requestAccess(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice("");

    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: {
        emailRedirectTo: authRedirectUrl(),
        shouldCreateUser: false,
      },
    });

    setNotice(
      error
        ? "Não foi possível enviar o link agora. Aguarde um minuto e tente novamente."
        : `Link seguro enviado para ${ADMIN_EMAIL}. Abra o e-mail no mesmo navegador para acessar.`,
    );
    setLoading(false);
  }

  async function logout() {
    if (demoMode) {
      setDemoMode(false);
      setDemoIntents(demoIntentsSeed);
      setStatusFilter("all");
      setNotice("");
      return;
    }
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setIntents([]);
    setLoading(false);
    window.history.replaceState({}, "", `${window.location.pathname}#admin`);
  }

  async function updateStatus(intent: Intent, nextStatus: IntentStatus) {
    const destructive = nextStatus === "approved" || nextStatus === "declined";
    if (
      destructive &&
      !window.confirm(
        nextStatus === "approved"
          ? "Aprovar esta intenção marcará as obras como adquiridas. Deseja continuar?"
          : "Confirma a recusa/cancelamento desta intenção?",
      )
    ) return;

    setChangingId(intent.id);
    setNotice("");
    if (demoMode) {
      setDemoIntents((current) => current.map((item) => item.id === intent.id ? { ...item, status: nextStatus } : item));
      setNotice(`Teste concluído: status alterado para “${statusLabels[nextStatus]}”. Nenhum dado real foi modificado.`);
      setChangingId("");
      return;
    }
    const { error } = await supabase.rpc("admin_update_cart_status", {
      cart_id: intent.id,
      new_status: nextStatus,
    });

    if (error) {
      setNotice(error.message || "Não foi possível atualizar o status.");
    } else {
      await loadProposals();
      setNotice(`Status atualizado para “${statusLabels[nextStatus]}”.`);
    }
    setChangingId("");
  }

  const displayedIntents = demoMode ? demoIntents : intents;
  const visibleIntents = useMemo(
    () => statusFilter === "all" ? displayedIntents : displayedIntents.filter((intent) => intent.status === statusFilter),
    [displayedIntents, statusFilter],
  );
  const activeIntents = displayedIntents.filter((intent) => intent.status !== "declined");
  const confirmedIntents = displayedIntents.filter((intent) => intent.status === "approved" || intent.status === "paid");
  const activeTotal = activeIntents.reduce((sum, intent) => sum + intent.total_cents, 0);
  const confirmedTotal = confirmedIntents.reduce((sum, intent) => sum + intent.total_cents, 0);

  let content;
  if (!authReady) {
    content = <p className="admin-notice">Verificando acesso seguro…</p>;
  } else if (!session && !demoMode) {
    content = (
      <div className="admin-login">
        <p className="section-kicker">Área restrita</p>
        <h1>Intenções de compra</h1>
        <p>O painel é exclusivo do administrador. O acesso acontece por um link temporário enviado ao e-mail cadastrado.</p>
        <form onSubmit={requestAccess}>
          <button className="button primary" disabled={loading}>
            {loading ? "Enviando…" : "Enviar link de acesso"} <span>→</span>
          </button>
        </form>
        <div className="admin-demo-entry">
          <span>ou</span>
          <button type="button" className="button demo-button" onClick={() => { setDemoMode(true); setNotice(""); }}>
            Entrar no modo demonstração <span>→</span>
          </button>
          <small>Usa somente dados fictícios e não altera o acervo real.</small>
        </div>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
      </div>
    );
  } else if (!authorized && !demoMode) {
    content = (
      <div className="admin-login">
        <p className="section-kicker">Acesso negado</p>
        <h1>Conta não autorizada</h1>
        <p>Esta conta não possui permissão para consultar dados administrativos.</p>
        <button className="button primary" onClick={logout}>Sair desta conta <span>→</span></button>
      </div>
    );
  } else {
    content = (
      <div>
        {demoMode && <div className="demo-banner" role="status"><strong>Modo demonstração</strong><span>Você pode testar filtros e status com segurança. Nenhuma alteração será salva.</span></div>}
        <div className="admin-title">
          <div>
            <p className="section-kicker">{demoMode ? "Ambiente de teste" : "Painel administrativo"}</p>
            <h1>{demoMode ? "Teste do painel" : "Intenções registradas"}</h1>
          </div>
          {!demoMode && <button className="admin-refresh" onClick={loadProposals} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar dados"}
          </button>}
        </div>

        <div className="admin-stats">
          <div><span>Intenções</span><strong>{displayedIntents.length}</strong></div>
          <div><span>Em aberto</span><strong>{activeIntents.length}</strong></div>
          <div><span>Montante ativo</span><strong>{money.format(activeTotal / 100)}</strong></div>
          <div><span>Aprovado/pago</span><strong>{money.format(confirmedTotal / 100)}</strong></div>
        </div>

        <div className="admin-toolbar">
          <label htmlFor="status-filter">Filtrar por status</label>
          <select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | IntentStatus)}>
            <option value="all">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>

        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {loading && !displayedIntents.length ? (
          <p className="admin-notice">Carregando registros…</p>
        ) : (
          <div className="intent-list">
            {visibleIntents.length ? visibleIntents.map((intent) => (
              <article className="intent-card" key={intent.id}>
                <div className="intent-top">
                  <div>
                    <span className={`intent-status ${intent.status}`}>{statusLabels[intent.status]}</span>
                    <h2>{intent.bidder_name}</h2>
                    <p>{new Date(intent.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <strong>{money.format(intent.total_cents / 100)}</strong>
                </div>

                <div className="intent-contact">
                  <a href={`tel:${intent.bidder_phone}`}>{intent.bidder_phone}</a>
                  <a href={`mailto:${intent.bidder_email}`}>{intent.bidder_email}</a>
                  <span>Pagamento presencial</span>
                </div>

                <ul>
                  {intent.items.map((item) => (
                    <li key={item.artwork_id}>
                      <span>{item.artwork_title}</span>
                      <small>{item.artwork_code} · {money.format(item.amount_cents / 100)}</small>
                    </li>
                  ))}
                </ul>

                {statusActions[intent.status].length > 0 && (
                  <div className="intent-actions" aria-label={`Ações para ${intent.bidder_name}`}>
                    {statusActions[intent.status].map((action) => (
                      <button
                        key={action.status}
                        className={action.status}
                        disabled={changingId === intent.id}
                        onClick={() => updateStatus(intent, action.status)}
                      >
                        {changingId === intent.id ? "Salvando…" : action.label}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            )) : <p className="admin-notice">Nenhuma intenção encontrada neste filtro.</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="#inicio">← Voltar ao site</a>
        <span>Controle pessoal · Arte pela Basílica</span>
        {(session || demoMode) && <button onClick={logout}>{demoMode ? "Encerrar teste" : "Sair"}</button>}
      </header>
      <section className="admin-wrap">{content}</section>
    </main>
  );
}
