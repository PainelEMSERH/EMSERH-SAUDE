# Changelog

## 0.2.2 — 2026-07-18

### Security / acesso
- Troca de senha obrigatória (`mustResetPassword`) com página `/trocar-senha`
- Escopo regional/unidade na criação e edição de usuários (admin)
- Download autenticado de anexos em `GET /api/files/[id]` com escopo

### Integridade operacional
- Acidente biológico: follow-ups 30/60/90 em insert único + rollback se falhar
- Afastamentos: prorrogação (`leave_extensions`) e registro de retorno (`return_to_work_records`)
- Vacinação: recusa → `vaccine_refusals`; Anti-HBs → `immunity_tests` (sem colapsar dose 0→1)
- Gestantes: histórico de status e trilha de realocação
- Import XLSX: `parseBooleanPtBr` no PEP; doses/situações de vacina corretas

### Observabilidade
- `/api/health` faz ping no Neon (503 se indisponível)
- Auditoria deixa de engolir erros em silêncio (`console.error`)
- Relatórios sinalizam truncamento (10k) no nome do arquivo e headers

### Nota
- Cálculo de indicadores/metas de ASO **não** foi alterado

## 0.2.1 — 2026-07-16

### Security (P0)
- Escopo regional/unidade centralizado em mutações (`requireEmployeeInUserScope`)
- Dashboard com métricas filtradas no SQL pelo escopo do usuário
- Prontuário: abas e queries condicionadas à permissão de cada módulo
- CID só selecionado/exibido com `view_clinical`
- Sync global do espelho restrita a `imports.sync_global` (SUPER_ADMIN / ADMIN_CENTRAL)
- Trava contra sincronizações concorrentes (`import_batches` RUNNING)
- ID do espelho removido do código; obrigatório via `ALTERDATA_MIRROR_SHEET_ID`

### Docs
- Auditoria técnica `docs/TECHNICAL_AUDIT_2026-07-16.md`
- ARCHITECTURE/DATABASE alinhados ao Neon já conectado

## 0.2.0 — 2026-07-16

### Added
- Fase 2: regionais, unidades, colaboradores (lista, cadastro, edição, perfil com timeline)
- Fase 3: ASOs com vencimento por meses reais + agenda médica (IMC, presença, conduta)
- Fase 4: afastamentos com CID normalizado e histórico
- Fase 5: vacinação por dose + catálogo inicial (regra consolidada pendente de validação)
- Fase 6: gestantes com alerta de insalubridade; material biológico com follow-ups 30/60/90 automáticos
- Fase 7: atendimentos ambulatoriais + catálogo de indicadores rastreáveis
- Fase 8: scripts reais de importação Alterdata/ocupacional/indicadores (com `--yes`)
- Fase 9: exportações CSV autenticadas com auditoria

### Notes
- Neon conectado em produção; migração inicial aplicada
- Regras ASO aderência / notificações / atualização vacinal permanecem `PENDENTE_VALIDACAO`

## 0.1.0 — 2026-07-16

### Added
- Scaffold Next.js 15 + TypeScript + Tailwind + shadcn/ui + Geist
- Modelagem Drizzle (57 tabelas) e autenticação/RBAC/auditoria
- Deploy Vercel `emserh-saude`
