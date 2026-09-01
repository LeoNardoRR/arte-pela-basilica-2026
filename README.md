<h1 align="center">Arte pela Basílica · 2026</h1>

<p align="center">
  <strong>Uma coleção com propósito. Uma experiência para guardar.</strong><br />
  Catálogo digital, galeria 3D e pré-reservas para a exposição beneficente da Basílica Santo Antônio.
</p>

<p align="center">
  <a href="https://leonardorr.github.io/arte-pela-basilica-2026/"><strong>Visitar o catálogo público</strong></a>
  ·
  <a href="https://leonardorr.github.io/arte-pela-basilica-2026/#acervo">Explorar as obras</a>
</p>

<p align="center">
  <a href="https://github.com/LeoNardoRR/arte-pela-basilica-2026/actions/workflows/pages.yml"><img alt="GitHub Pages" src="https://img.shields.io/github/actions/workflow/status/LeoNardoRR/arte-pela-basilica-2026/pages.yml?branch=main&style=flat-square&label=GitHub%20Pages&color=000666" /></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-000666?style=flat-square&logo=react&logoColor=white" />
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-3D-B7904B?style=flat-square&logo=threedotjs&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-2D6A4F?style=flat-square&logo=supabase&logoColor=white" />
</p>

---

## Sobre o projeto

**Arte pela Basílica 2026** transforma o catálogo oficial da exposição em uma experiência digital responsiva. O visitante pode conhecer as **84 obras**, explorar suas imagens em uma apresentação 3D, montar uma seleção e registrar uma pré-reserva para conclusão presencial.

O projeto apoia financeiramente a **Basílica Santo Antônio de Pádua**, em Americana. O site não processa pagamentos de obras: ele registra a intenção, bloqueia temporariamente a disponibilidade e apresenta as instruções para a conclusão presencial.

> **Evento:** 10 de setembro de 2026, no Hotel Florença — Av. de Cillo, 820, Americana/SP.

## Funcionalidades

| Experiência pública | Operação privada |
|---|---|
| Catálogo editorial com 84 obras oficiais | Autenticação administrativa pelo Supabase |
| Filtros por disponibilidade | Fila agrupada por interessado |
| Galeria em tela cheia e visualização 3D | Histórico de intenções e contatos |
| Seleção com total e contribuição adicional | Atualização de status e disponibilidade |
| Pré-reserva com protocolo e cronômetro | Controle de preços com centavos |
| Navegação acessível e layout responsivo | Acesso a PII protegido por JWT, RLS e RPC |
| Música ambiente opcional | Sessão administrativa não persistida no navegador |
| Doação independente por QR Code PIX | Registros persistidos no PostgreSQL |

## Fluxo de pré-reserva

| Período | Bloqueio | Conclusão |
|---|---:|---|
| **10 de setembro · evento** | **30 minutos** | Hotel Florença |
| **11 a 17 de setembro** | **24 horas** | Basílica Santo Antônio de Pádua |

A pré-reserva:

- não realiza cobrança online;
- calcula preços e totais no servidor;
- rejeita preços enviados ou adulterados pelo navegador;
- bloqueia a obra de forma transacional;
- limita solicitações repetidas por contato;
- libera reservas expiradas antes de uma nova tentativa.

## Arquitetura

~~~mermaid
flowchart LR
    V[Visitante] --> UI[React + Vinext]
    UI -->|consulta pública| A[(Supabase: artworks)]
    UI -->|submit_pre_reservation| R[RPC pública validada]
    R --> C[(auction_carts)]
    R --> I[(auction_cart_items)]

    ADM[Administrador autenticado] --> AUTH[Supabase Auth]
    AUTH --> CLAIM[app_metadata: basilica_admin]
    CLAIM --> RPC[RPCs administrativas]
    RPC --> C
    RPC --> I
    RPC --> A
~~~

O frontend usa apenas uma chave **publishable**, pública por definição. A segurança não depende de esconder essa chave: ela é aplicada no banco por permissões explícitas, Row Level Security e validação de autorização em cada operação administrativa.

## Segurança e privacidade

O projeto adota os seguintes controles:

- <code>admin_get_proposals</code> executa como **SECURITY INVOKER** e não possui permissão para <code>anon</code>;
- autorização administrativa baseada em atributo confiável de <code>app_metadata</code>, sem e-mail fixo no bundle;
- tabelas com PII protegidas por RLS e sem leitura pública;
- RPCs administrativas disponíveis somente para usuários autenticados e autorizados;
- sessão administrativa mantida apenas em memória;
- protocolo e dados do interessado não são gravados em <code>localStorage</code>;
- superfície D1 legada desativada, evitando um segundo banco de reservas;
- Content Security Policy e headers de isolamento aplicados pelo Worker;
- nenhuma chave <code>service_role</code>, senha ou token privado deve ser incluído no frontend.

> Não publique nomes, e-mails, telefones, tokens ou amostras reais de propostas em Issues, logs ou capturas de tela.

## Tecnologias

| Camada | Ferramentas |
|---|---|
| Interface | React 19, TypeScript e CSS |
| Aplicação web | Next.js 16, Vinext e Vite |
| Movimento e 3D | Three.js, GSAP e ScrollTrigger |
| Dados e autenticação | Supabase, PostgreSQL e RLS |
| Infraestrutura | Cloudflare Workers, Sites e GitHub Pages |
| Qualidade | ESLint e Node.js Test Runner |

## Executando localmente

### Requisitos

- Node.js <code>>= 22.13.0</code>
- npm compatível com o lockfile

### Instalação

~~~bash
git clone https://github.com/LeoNardoRR/arte-pela-basilica-2026.git
cd arte-pela-basilica-2026
npm ci
~~~

### Desenvolvimento

~~~bash
npm run dev
~~~

Para executar especificamente a versão estática usada pelo GitHub Pages:

~~~bash
npm run dev:pages
~~~

O endereço local é informado no terminal.

## Validação

~~~bash
npm test              # build Vinext + testes automatizados
npm run lint          # análise estática
npm run build         # build do Worker/Sites
npm run build:pages   # build estático do GitHub Pages
npm audit --omit=dev  # dependências utilizadas em produção
~~~

Antes de publicar, confirme também:

1. catálogo e filtros em desktop e celular;
2. formulário com dados válidos e inválidos;
3. payload com preço adulterado;
4. acesso anônimo negado às RPCs administrativas;
5. usuário autenticado sem atributo administrativo recebendo acesso negado;
6. headers de segurança na URL publicada;
7. ausência de PII, senhas e chaves privadas no bundle.

## Banco de dados

As migrações ficam em [<code>supabase/migrations/</code>](supabase/migrations/) e registram:

- catálogo e preços das obras;
- intenções e itens selecionados;
- pré-reservas temporárias;
- políticas de RLS;
- funções públicas e administrativas;
- endurecimento de privilégios e limites de abuso.

As migrações devem ser revisadas e aplicadas em ordem. Mudanças no frontend não substituem a aplicação da migração correspondente no Supabase.

## Publicação

### GitHub Pages

O workflow [<code>.github/workflows/pages.yml</code>](.github/workflows/pages.yml) publica o catálogo estático quando o branch <code>main</code> é atualizado.

### Sites

O build Vinext é publicado no projeto Sites configurado em <code>.openai/hosting.json</code>. Esse ambiente hospeda a versão operacional privada e os headers definidos em [<code>worker/index.ts</code>](worker/index.ts).

O binding D1 está desativado. O Supabase é a única fonte ativa para catálogo, pré-reservas e operação administrativa.

## Estrutura principal

~~~text
app/
├── Admin.tsx                  # painel autenticado
├── ArtworkExperience3D.tsx   # visualização tridimensional
├── Catalog.tsx               # catálogo e pré-reserva
├── DonationSection.tsx       # doação via QR Code PIX
├── ReservationCountdown.tsx  # prazo e alertas
└── globals.css               # identidade visual e responsividade

public/
├── artworks-clean/            # imagens tratadas das 84 obras
├── sponsors/                  # marcas dos parceiros
└── audio-air-bach.ogg         # ambientação sonora opcional

supabase/migrations/           # schema, RLS, RPCs e hardening
tests/                         # regressão funcional e de segurança
worker/index.ts                # entrada do Worker e headers
~~~

## Parceiros desta edição

Hotel Florença · Contatto Transportes · Buquê de Flor · Quadrum · Juarez Godoy Arte e Cultura

## Conteúdo e créditos

As fotografias das obras e as marcas dos parceiros pertencem aos respectivos titulares e são utilizadas na apresentação oficial do evento. A ambientação sonora utiliza **Air**, de Bach, em gravação da U.S. Air Force Band disponibilizada em domínio público.

---

<p align="center">
  <img src="public/brasao-basilica.png" alt="Brasão da Basílica Santo Antônio" width="76" /><br />
  <strong>Arte pela Basílica · Edição 2026</strong><br />
  Arte e participação comunitária em apoio à Basílica Santo Antônio.
</p>
