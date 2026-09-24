#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (process.env[key]) continue;
    process.env[key] = rest.join("=").trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(scriptDir, "../../../../.env"));
loadEnvFile(resolve(scriptDir, "../.env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "luodxzttfbnnufxufehb";
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_NAME = process.env.BASILICA_EMAIL_SENDER_NAME || "Basílica Santo Antônio de Pádua";
const SENDER_EMAIL = process.env.BASILICA_EMAIL_SENDER_EMAIL || "pastoral@basilicasantoantonio.com.br";
const INTERNAL_RECIPIENTS = (process.env.BASILICA_ARTWORK_INTERNAL_EMAILS || "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);
const BATCH_SIZE = Number(process.env.BASILICA_EMAIL_BATCH_SIZE || 20);

if ((!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) && !SUPABASE_ACCESS_TOKEN) {
  console.error("Defina SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}
if (!BREVO_API_KEY) {
  console.error("Defina BREVO_API_KEY.");
  process.exit(1);
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function runManagementQuery(query) {
  if (!SUPABASE_ACCESS_TOKEN) throw new Error("SUPABASE_ACCESS_TOKEN ausente.");
  const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase Management API ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const formatCents = (cents) => money.format(Number(cents || 0) / 100);

function worksRows(works = []) {
  return works.map((work) => `
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e7e0d2;color:#000666;font-weight:700;">${escapeHtml(work.code)}</td>
      <td style="padding:10px 0;border-top:1px solid #e7e0d2;">${escapeHtml(work.title)}<br><small style="color:#7a7469;">${escapeHtml(work.dimensions)}</small></td>
      <td style="padding:10px 0;border-top:1px solid #e7e0d2;text-align:right;font-weight:700;">${formatCents(work.amount_cents)}</td>
    </tr>`).join("");
}

function shell(title, preheader, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f1ec;color:#181822;font-family:Inter,Arial,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;"><tr><td align="center" style="padding:32px 12px;"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #ded6c4;border-radius:6px;"><tr><td style="padding:28px 32px;background:#000666;border-bottom:3px solid #fed65b;"><strong style="font-family:Georgia,serif;font-size:22px;color:#fbf9f8;">Basílica Santo Antônio</strong><span style="float:right;padding-top:7px;color:#fed65b;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Arte pela Basílica</span></td></tr><tr><td style="padding:36px 32px;">${body}</td></tr><tr><td style="padding:18px 32px;background:#fbf9f8;border-top:1px solid #dedee8;color:#7a7a85;font-size:11px;line-height:1.6;">${escapeHtml(title)} · Mensagem transacional da Basílica Santo Antônio.</td></tr></table></td></tr></table></body></html>`;
}

function buyerEmail(row) {
  const p = row.payload;
  const body = `
    <p style="margin:0 0 12px;color:#8a6b00;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Pré-reserva confirmada</p>
    <h1 style="margin:0 0 18px;color:#000666;font-family:Georgia,serif;font-size:30px;line-height:1.2;">Olá, ${escapeHtml(p.bidder_name)}.</h1>
    <p style="margin:0 0 18px;color:#3a3a46;font-size:15px;line-height:1.75;">Agradecemos seu apoio à Basílica Santo Antônio. Sua pré-reserva foi registrada com sucesso.</p>
    <div style="margin:24px 0;padding:18px 20px;background:#fbf9f8;border-left:4px solid #c9a227;"><strong style="color:#000666;">Código da reserva</strong><br><span style="font-size:24px;font-weight:800;letter-spacing:.06em;">${escapeHtml(p.confirmation_code)}</span></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:collapse;">${worksRows(p.works)}</table>
    <p style="margin:0 0 18px;color:#000666;font-size:18px;font-weight:800;">Valor total: ${formatCents(p.total_cents)}</p>
    <p style="margin:0;color:#3a3a46;font-size:15px;line-height:1.75;">Para reservas realizadas pelo site a partir de 23 de setembro, o pagamento e a retirada da obra são feitos na secretaria da Basílica. Apresente o código da reserva e a identificação da obra para que a equipe possa localizar sua compra.</p>`;
  return shell("Pré-reserva confirmada", `Reserva ${p.confirmation_code} confirmada.`, body);
}

function internalEmail(row) {
  const p = row.payload;
  const body = `
    <p style="margin:0 0 12px;color:#8a6b00;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Nova reserva de obra</p>
    <h1 style="margin:0 0 18px;color:#000666;font-family:Georgia,serif;font-size:30px;line-height:1.2;">${escapeHtml(p.confirmation_code)}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
      <tr><td style="padding:10px 0;border-top:1px solid #e7e0d2;color:#7a7469;">Comprador</td><td style="padding:10px 0;border-top:1px solid #e7e0d2;font-weight:700;">${escapeHtml(p.bidder_name)}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid #e7e0d2;color:#7a7469;">E-mail</td><td style="padding:10px 0;border-top:1px solid #e7e0d2;">${escapeHtml(p.bidder_email)}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid #e7e0d2;color:#7a7469;">WhatsApp</td><td style="padding:10px 0;border-top:1px solid #e7e0d2;">${escapeHtml(p.bidder_phone)}</td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:collapse;">${worksRows(p.works)}</table>
    <p style="margin:0 0 18px;color:#000666;font-size:18px;font-weight:800;">Valor total: ${formatCents(p.total_cents)}</p>
    <div style="margin:22px 0 0;padding:18px 20px;background:#fbf9f8;border-left:4px solid #c9a227;color:#3a3a46;font-size:14px;line-height:1.65;"><strong style="color:#000666;">Ação operacional</strong><br>Reserva feita pelo site: identificar a obra, receber o pagamento e realizar a retirada na secretaria da Basílica. Depois, registrar a conclusão no painel administrativo.</div>`;
  return shell("Nova reserva de obra", `Nova reserva ${p.confirmation_code}.`, body);
}

async function sendBrevoEmail({ to, subject, htmlContent, replyTo }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to,
      replyTo,
      subject,
      htmlContent,
      tags: ["arte-pela-basilica", "reservation"],
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function mark(id, patch) {
  const next = { ...patch, updated_at: new Date().toISOString() };
  if (supabase) {
    const { error } = await supabase.from("reservation_email_queue").update(next).eq("id", id);
    if (error) throw error;
    return;
  }
  const assignments = Object.entries(next).map(([key, value]) => `${key} = ${sqlLiteral(value)}`).join(", ");
  await runManagementQuery(`update public.reservation_email_queue set ${assignments} where id = ${sqlLiteral(id)};`);
}

async function loadDueRows() {
  if (supabase) {
    const { data, error } = await supabase
      .from("reservation_email_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    return data ?? [];
  }
  return await runManagementQuery(`
    select *
    from public.reservation_email_queue
    where status in ('pending', 'failed')
      and next_attempt_at <= now()
    order by created_at asc
    limit ${Number.isFinite(BATCH_SIZE) ? BATCH_SIZE : 20};
  `);
}

const rows = await loadDueRows();

for (const row of rows ?? []) {
  try {
    await mark(row.id, { status: "sending", attempts: Number(row.attempts || 0) + 1, last_error: null });
    const isInternal = row.message_kind === "internal_notification";
    const to = isInternal
      ? INTERNAL_RECIPIENTS.map((email) => ({ email }))
      : [{ email: row.recipient_email, name: row.recipient_name || row.payload?.bidder_name }];
    if (!to.length) throw new Error("Nenhum destinatário interno configurado em BASILICA_ARTWORK_INTERNAL_EMAILS.");
    const result = await sendBrevoEmail({
      to,
      subject: row.subject,
      htmlContent: isInternal ? internalEmail(row) : buyerEmail(row),
      replyTo: isInternal && row.payload?.bidder_email ? { name: row.payload.bidder_name, email: row.payload.bidder_email } : undefined,
    });
    await mark(row.id, { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.messageId || null });
    console.log(`sent ${row.message_kind} ${row.id}`);
  } catch (err) {
    const attempts = Number(row.attempts || 0) + 1;
    const delayMinutes = Math.min(60, Math.max(5, attempts * 5));
    await mark(row.id, {
      status: "failed",
      last_error: err instanceof Error ? err.message : String(err),
      next_attempt_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
    });
    console.error(`failed ${row.message_kind} ${row.id}:`, err);
  }
}
