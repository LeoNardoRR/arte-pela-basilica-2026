# Arte pela Basílica 2026

Site público do evento Arte pela Basílica, com catálogo responsivo e reservas persistentes.

## Funcionamento

- Front-end React/Vite publicado no GitHub Pages.
- Catálogo e reservas armazenados no Supabase.
- Reserva atômica: apenas a primeira solicitação para uma obra disponível é aceita.
- Dados pessoais das reservas não possuem leitura pública.

## Desenvolvimento

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm test
```

O fluxo em `.github/workflows/pages.yml` publica automaticamente o conteúdo da branch `main`.
