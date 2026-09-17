# Comunicação transacional das reservas

Este pacote deixa pronto o envio de confirmação para o comprador e de aviso interno para a equipe do evento, sem depender do navegador do visitante.

## Fluxo

1. `submit_pre_reservation` confirma a reserva no Supabase.
2. A obra é bloqueada e a reserva aparece no painel administrativo existente.
3. A função `enqueue_pre_reservation_emails` cria dois registros em `reservation_email_queue`:
   - `buyer_confirmation`, para o comprador;
   - `internal_notification`, para o grupo interno.
4. O worker `scripts/send-reservation-emails.mjs` envia os e-mails via Brevo e marca cada item como `sent` ou `failed`.
5. Em caso de falha, o mesmo worker tenta novamente depois.

## Variáveis do worker

```bash
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=... # opcional se usar SUPABASE_ACCESS_TOKEN
SUPABASE_ACCESS_TOKEN=... # alternativa aprovada para Management API
SUPABASE_PROJECT_REF=luodxzttfbnnufxufehb
BREVO_API_KEY=...
BASILICA_EMAIL_SENDER_NAME=Basílica Santo Antônio de Pádua
BASILICA_EMAIL_SENDER_EMAIL=pastoral@basilicasantoantonio.com.br
BASILICA_ARTWORK_INTERNAL_EMAILS=02.pastoral@diocesedelimeira.org.br,basilicasantoantonio.nog@gmail.com,basilicasantoantonio@gmail.com
node scripts/send-reservation-emails.mjs
```

## Agendamento

O worker está agendado em `.github/workflows/send-reservation-emails.yml`. Ele roda automaticamente a cada 5 minutos e também pode ser disparado manualmente pelo GitHub Actions.

Secrets necessários no GitHub:

```bash
SUPABASE_ACCESS_TOKEN=...
SUPABASE_PROJECT_REF=luodxzttfbnnufxufehb
BREVO_API_KEY=...
```

Opcionalmente, se preferir usar chave service role em vez da Management API:

```bash
SUPABASE_URL=https://luodxzttfbnnufxufehb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Alternativa n8n/VPS: criar um fluxo Cron a cada 5 minutos que execute `npm run send:reservation-emails` neste diretório, com as mesmas variáveis acima no ambiente.

## Observações

- O contato é transacional, não newsletter.
- A chave Brevo e a credencial Supabase ficam somente no worker/backend.
- O site público não recebe nenhum segredo.
- O e-mail interno deve ir para a secretaria usada nos forms do site (`02.pastoral@diocesedelimeira.org.br`), para `basilicasantoantonio.nog@gmail.com` e para `basilicasantoantonio@gmail.com`.
- A migração deste pacote estende reservas ativas e novas para depois de 22/09 (`2026-09-23 00:00:00-03`), evitando liberação automática antes do evento. A mudança só entra em produção depois que a migração for aplicada no Supabase.
