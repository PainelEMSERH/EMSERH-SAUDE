# Changelog

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
