# Arquitetura — EMSERH Saúde Ocupacional

## Objetivo

Substituir as planilhas de gestão de enfermagem/saúde ocupacional por um sistema web institucional com persistência no Neon Postgres, autenticação própria, RBAC por escopo e auditoria.

## Stack

- Next.js App Router + TypeScript strict
- Tailwind CSS + shadcn/ui + Geist
- Neon Postgres + Drizzle ORM
- Zod + React Hook Form
- Vercel Blob (privado) para anexos
- Deploy: GitHub `main` → Vercel Production

## Princípios

1. Sem mocks/dados falsos em produção.
2. Cliente de banco lazy (não inicializa no build).
3. Autorização sempre no servidor.
4. CPF/CNS criptografados; busca por hash; máscara sem permissão.
5. Observações clínicas isoladas e nunca em listagens.
6. Soft delete (`deleted_at`) para registros de negócio.
7. Migrações apenas aditivas em produção.

## Domínios

| Schema | Conteúdo |
|--------|----------|
| `auth` | usuários, sessões, tentativas, permissões |
| `core` | regionais, unidades, setores, funções, colaboradores |
| `occupational` | ASO, agenda, afastamentos, vacinas, gestantes, material biológico, atendimentos |
| `files` | anexos e lotes de importação |
| `reporting` | indicadores, metas, resultados |
| `audit` | trilha de auditoria |

## Fluxo operacional alvo

Alterdata/planilhas → scripts de importação locais → Neon → painel (escopo + RBAC) → indicadores/relatórios.

## Estado atual

Base técnica, modelagem e shells protegidos prontos. Conexão Neon e migração inicial ficam para a etapa de configuração combinada (sem consumir créditos/API agora).
