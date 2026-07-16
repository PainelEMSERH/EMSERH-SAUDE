# Banco de dados

## Conexões

- `DATABASE_URL`: pooled (runtime serverless)
- `DATABASE_URL_UNPOOLED`: direta (migrações Drizzle Kit)

## Comandos

```bash
npm run db:generate
npm run db:migrate:prod
npm run db:studio
```

## Regras de migração

1. Gerar e revisar SQL.
2. Preferir mudanças aditivas.
3. Backup/ponto de restauração no Neon antes de aplicar.
4. Nunca `NOT NULL` sem default em tabela populada.
5. Remoções em etapas (expand/contract).

## Índices prioritários

- colaboradores: matrícula, cpf_hash, regional, unidade, status, nome normalizado
- ASO: próximo ASO, deadline, tipo, unidade
- afastamentos: status, datas, CID normalizado
- agenda: profissional + horário (único)
- material biológico: vencimento de follow-ups
- auditoria: usuário, entidade, ação, created_at

## Schemas lógicos

Criados via Drizzle `pgSchema`: `auth`, `core`, `occupational`, `files`, `reporting`, `audit`.

## Pendência

Aplicação das migrações no Neon de produção será feita quando as variáveis forem configuradas.
