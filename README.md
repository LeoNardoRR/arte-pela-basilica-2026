# Arte pela Basílica — Exposição 2026

Uma experiência digital de alto padrão criada para apresentar a exposição beneficente **Arte pela Basílica**, facilitar a descoberta das obras e registrar intenções de compra para conclusão presencial com a equipe do evento.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-online-000666?style=flat-square&logo=github)](https://leonardorr.github.io/arte-pela-basilica-2026/)
[![React](https://img.shields.io/badge/React-19-1a237e?style=flat-square&logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D-b7904b?style=flat-square&logo=threedotjs)](https://threejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-dados-24612b?style=flat-square&logo=supabase)](https://supabase.com/)

![Prévia da experiência Arte pela Basílica](public/og.png)

## Acessos

- **GitHub Pages:** [leonardorr.github.io/arte-pela-basilica-2026](https://leonardorr.github.io/arte-pela-basilica-2026/)
- **Versão principal:** [arte-pela-basilica-2026.ribeiroleonardoti.chatgpt.site](https://arte-pela-basilica-2026.ribeiroleonardoti.chatgpt.site/)
- **Administrativo:** use `#admin` ao final de qualquer um dos endereços. O acesso exige a conta autorizada no Supabase.

## Experiência

- Catálogo editorial com **60 obras** e valores fixos.
- Filtros priorizando obras disponíveis, seguidos de indisponíveis e visão completa.
- Pré-visualizações que respeitam a proporção original de cada quadro.
- Galeria responsiva para desktop, tablet e celular.
- Detalhe individual com experiência 3D em Three.js.
- Rotação do quadro por toque ou mouse, com frente, espessura e verso.
- Animações com GSAP ScrollTrigger e alternativa estática para `prefers-reduced-motion`.
- Seleção de obras e registro de intenção de compra sem cobrança online.

## Visualização 3D

O 3D aparece somente no detalhe da obra, evitando múltiplos canvases concorrentes na galeria. A arte é aplicada diretamente ao material do modelo, enquanto o grupo 3D controla movimento, rotação e escala.

Principais cuidados:

- textura aplicada como `material.map`;
- transparência da textura revela a cor base sem perfurar o mesh;
- interação por arraste em telas sensíveis ao toque e com mouse;
- renderização ativa apenas durante a experiência;
- enquadramento responsivo para obras verticais e horizontais;
- modo reduzido de movimento respeitado.

## Área administrativa

O painel organiza as intenções por pessoa e mantém a operação presencial clara:

- resumo de pessoas, intenções e valores;
- filtros com contadores por status;
- contatos, obras e valores agrupados por interessado;
- histórico de intenções com rolagem interna quando necessário;
- ações para atendimento, confirmação, cancelamento e conclusão;
- autenticação protegida pelo Supabase, sem senha armazenada no código.

## Arquitetura

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Interface | React 19 + TypeScript | Catálogo, galeria, seleção e painel |
| 3D e movimento | Three.js + GSAP | Modelo interativo e animações |
| Dados e autenticação | Supabase | Obras, intenções, sessão administrativa e regras de acesso |
| Aplicação principal | Vinext + Cloudflare | Versão completa hospedada no Sites |
| Publicação estática | Vite + GitHub Actions | Versão equivalente no GitHub Pages |

As duas publicações compartilham os mesmos componentes de interface. O GitHub Pages executa a aplicação no navegador e acessa o Supabase diretamente com a chave pública; operações protegidas continuam sujeitas às regras de autenticação, RPC e RLS do projeto.

## Rodar localmente

Requisitos: Node.js `>=22.13.0`.

```bash
npm install
```

Versão principal:

```bash
npm run dev
```

Prévia específica do GitHub Pages:

```bash
npm run dev:pages
```

## Validação e builds

```bash
# Build principal e testes
npm test

# Build estático usado pelo GitHub Pages
npm run build:pages

# Verificação de código
npm run lint
```

O workflow em `.github/workflows/pages.yml` instala as dependências, cria o build estático e publica o conteúdo no GitHub Pages a cada atualização do branch `main`.

## Fluxo comercial

O site registra uma **intenção de compra**. Não existe cobrança ou pagamento online: a equipe confirma a disponibilidade e conclui a aquisição presencialmente no evento.

Os valores utilizados na interface são validados no servidor pelo Supabase; o navegador não é considerado fonte confiável para preços ou totais.

## Créditos das imagens

As 60 imagens usadas como referências visuais pertencem ao acervo de domínio público do [The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection). Cada detalhe de obra mantém um link para a ficha de origem correspondente.

---

**Arte pela Basílica · Edição 2026**
Uma coleção com propósito. Uma experiência para guardar.
