# EMSERH Saúde Ocupacional

Sistema web institucional de Gestão da Saúde Ocupacional da EMSERH.

## Stack

Next.js · TypeScript · Tailwind · shadcn/ui · Neon · Drizzle · Vercel

## Desenvolvimento

```bash
cp .env.example .env.local
npm ci
npm run dev
```

## Validações obrigatórias

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Banco](docs/DATABASE.md)
- [RBAC](docs/RBAC.md)
- [Indicadores](docs/INDICATORS.md)
- [Importação](docs/IMPORT_MAPPING.md)
- [Deploy](docs/DEPLOYMENT.md)
