# Deploy

## Repositório

- GitHub: `PainelEMSERH/EMSERH-SAUDE`
- Branch de produção: `main`

## Checklist antes do push

```bash
npm ci
npm run lint
npm run typecheck
npm run build
git status
```

## Variáveis (Vercel + local)

Ver `.env.example`. Nenhum segredo no Git.

Ordem sugerida de configuração:

1. Criar projeto Neon
2. Preencher `DATABASE_URL` e `DATABASE_URL_UNPOOLED`
3. Gerar `AUTH_SECRET` e `FIELD_ENCRYPTION_KEY` (>= 32 chars)
4. Configurar `BLOB_READ_WRITE_TOKEN`
5. `npm run db:migrate:prod`
6. `npx tsx scripts/create-admin.ts`
7. Conectar Vercel ao repo (`main` = Production)

## Observações

- Enquanto Neon não estiver configurado, `/api/health` reporta `databaseConfigured: false`.
- Login recusa operação com mensagem segura se faltar configuração.
