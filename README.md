# Arte pela Basílica - Exposição 2026

Uma experiência digital de alto padrão criada para apresentar a exposição beneficente **Arte pela Basílica**, facilitar a descoberta das obras e registrar intenções de compra para conclusão presencial com a equipe do evento.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-online-000666?style=flat-square&logo=github)](https://leonardorr.github.io/arte-pela-basilica-2026/)
[![React](https://img.shields.io/badge/React-19-1a237e?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D-b7904b?style=flat-square&logo=threedotjs)](https://threejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-dados-24612b?style=flat-square&logo=supabase)](https://supabase.com/)

---

## Sobre o Site

O **Arte pela Basílica 2026** é uma plataforma web beneficente que reúne 60 obras de arte em uma galeria interativa e imersiva. O visitante pode explorar o acervo, visualizar cada obra em detalhes — inclusive em 3D — e registrar sua intenção de aquisição antes do evento presencial.

O projeto foi desenhado com estética de alto padrão (inspirada em casas como Christie's e Sotheby's): tipografia refinada, paleta sóbria, animações suaves e uma experiência 3D completa com rotação das obras, detalhes de profundidade e acabamento realístico em madeira e tela.

Não há cobrança online: toda aquisição é confirmada e concluída presencialmente pela equipe do evento.

---

## Acesso

- **GitHub Pages:** [leonardorr.github.io/arte-pela-basilica-2026](https://leonardorr.github.io/arte-pela-basilica-2026/)
- **Área Administrativa:** adicione `#admin` ao final do endereço. Requer autenticação pela conta autorizada no Supabase.

---

## Funcionalidades

- Catálogo editorial com **60 obras** e valores fixos
- Filtros priorizando obras disponíveis, seguidos de indisponíveis e visão completa
- Pré-visualizações que respeitam a proporção original de cada quadro
- Galeria responsiva para desktop, tablet e celular
- Carrinho flutuante com quantidade e valor da seleção sempre visíveis
- Detalhe individual com **experiência 3D interativa** via Three.js
- Rotação da obra por toque ou mouse — frente, espessura e verso em acabamento realístico
- Animações fluidas com GSAP ScrollTrigger
- Respeito ao `prefers-reduced-motion` para acessibilidade
- Registro de intenção de compra sem cobrança online
- Áudio ambiente opcional para enriquecer a experiência na galeria
- **Certificado digital** de intenção de compra gerado automaticamente após o registro

---

## Linguagens e Tecnologias

| Camada | Tecnologia | Finalidade |
|---|---|---|
| Linguagem principal | **TypeScript** | Tipagem estática em todo o projeto |
| Interface | **React 19** | Catálogo, galeria, seleção e painel |
| Estilização | **CSS** (Vanilla) | Design system, animações e responsividade |
| 3D e movimento | **Three.js + GSAP** | Modelo interativo e animações de scroll |
| Dados e autenticação | **Supabase** | Obras, intenções, sessão admin e regras de acesso |
| Build (Pages) | **Vite + GitHub Actions** | Build estático publicado automaticamente no GitHub Pages |
| Marcação | **HTML5** | Estrutura semântica e acessível |

---

## Como Instalar e Rodar Localmente

**Requisito:** Node.js `>=22.13.0`

### 1. Clone o repositório

```bash
git clone https://github.com/LeoNardoRR/arte-pela-basilica-2026.git
cd arte-pela-basilica-2026
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_publica_aqui
```

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Para prévia específica do GitHub Pages:

```bash
npm run dev:pages
```

A aplicação estará disponível em `http://localhost:5173` (ou porta indicada no terminal).

---

## Build e Deploy

```bash
# Build estático para GitHub Pages
npm run build:pages

# Verificação de tipos e lint
npm run lint
```

O workflow `.github/workflows/pages.yml` instala dependências, gera o build estático e publica automaticamente no GitHub Pages a cada push no branch `main`.

---

## Área Administrativa

O painel organiza as intenções por pessoa e apoia a operação presencial no evento:

- Resumo de pessoas, intenções e valores totais
- Filtros com contadores por status (pendente, em atendimento, confirmado, concluído, cancelado)
- Contatos, obras e valores agrupados por interessado
- Histórico de intenções com rolagem interna
- Ações para atendimento, confirmação, cancelamento e conclusão
- Autenticação protegida pelo Supabase — nenhuma senha armazenada no código

Acesso: adicione `#admin` ao final do endereço da aplicação.

---

## Fluxo Comercial

O site registra uma **intenção de compra**. Não existe cobrança ou pagamento online. A equipe confirma a disponibilidade e conclui a aquisição presencialmente no evento.

Os valores exibidos na interface são validados pelo Supabase; o navegador não é fonte confiável para preços ou totais.

---

## Créditos das Imagens

As imagens usadas como referências visuais pertencem ao acervo de domínio público do [The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection). Cada ficha de obra mantém um link para a origem correspondente.

---

## Certificado Digital de Intenção de Compra

Ao registrar uma intenção de compra, o colecionador recebe automaticamente um **certificado digital** personalizado contendo:

- Nome do interessado
- Código e título de cada obra selecionada
- Data e hora do registro
- Número de referência único

O certificado serve como comprovante formal da intenção e referência para o atendimento presencial no evento. Ele é gerado diretamente no navegador, sem necessidade de conexão adicional, e pode ser salvo ou impresso.

---

**Arte pela Basílica · Edição 2026**
Uma coleção com propósito. Uma experiência para guardar.
