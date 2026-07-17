# Auditoria Técnica — EMSERH Saúde Ocupacional

**Data:** 2026-07-16  
**Repositório:** `C:\Users\Sesmt\OneDrive\Desktop\EMSERH-SAUDE`  
**Produção:** https://emserh-saude.vercel.app  
**Método:** análise estática do código atual (sem alterações nesta etapa)

---

## Resumo executivo

| Dimensão | Avaliação |
|----------|-----------|
| Prontidão operacional | **Parcial (~45–55%)** — listagens + CRUD inicial + sync espelho; fluxos clínicos incompletos |
| Segurança / autorização | **Crítico** — listagens com escopo; mutações e dashboard sem escopo consistente |
| Integridade de importação | **Alto** — sync funciona, mas Serverless lenta/concorrente; XLSX ocupacional não idempotente |
| Indicadores / dashboard | **Baixo** — cards básicos; `pendingReturns=0`; ~9 definições vs ~43 institucionais |
| Administração | **Baixo** — só regionais/unidades; sem gestão de usuários na UI |

### Riscos críticos (P0)
1. Mutações por matrícula/ID **sem escopo regional/unidade**
2. Dashboard **global** (ignora escopo do usuário)
3. Prontuário carrega **todos os módulos** só com `employees.view`
4. CID e dados sensíveis em listagens sem `view_clinical`
5. Sync global disponível a quem tem `imports.create` (inclui coordenação/operador se matriz for ajustada; hoje coordenação tem `create`)
6. ID do espelho **hardcoded** no repositório

### Pontos já corretos
- Listagens principais usam `employeeScopeCondition` no SQL
- Auth com sessão httpOnly, rate limit de login, auditoria básica
- CPF criptografado + hash; máscara na listagem sem permissão sensível
- Soft delete; schemas lógicos; cliente Neon lazy
- Espelho Alterdata via GET (somente leitura) — sem escrita no Google
- Indicadores com status `PENDENTE_VALIDACAO` onde a regra é ambígua

### Módulos

| Módulo | Status |
|--------|--------|
| Login / sessão / RBAC TS | Funcional (matriz em código) |
| Colaboradores (lista/CRUD básico) | Parcialmente funcional |
| ASOs / Agenda / Afastamentos / Vacinas / Gestantes / Bio / Atendimentos | Cadastro inicial + lista — **não** fluxo completo |
| Sync espelho | Funcional (preferir script local/fast) |
| Indicadores | Só definições iniciais |
| Admin | Só org (regionais/unidades) |
| Arquivos Blob | Upload helper; **sem** rota de download autenticada |
| Relatórios CSV | Funcional com limite 5k silencioso |

---

## Matriz de observações

| ID | Observação | Resultado | Evidência | Risco | Ação |
| -- | ---------- | --------- | --------- | ----- | ---- |
| O2 | Mutações sem escopo | **CONFIRMADA** | `findEmployeeIdByRegistration` sem scope; `resolveEmployee` em `occupational.ts`; `upsertEmployeeAction` update por id sem scope | Crítico | `requireEmployeeInUserScope` |
| O3 | Dashboard sem escopo | **CONFIRMADA** | `getDashboardMetrics` não usa `employeeScopeCondition`; `user` só checa null | Crítico | Escopar todas as métricas no SQL |
| O4 | CID sem view_clinical | **CONFIRMADA** | `listLeaves` seleciona `cidCode`; ADMIN_CENTRAL/COORD/OPERADOR têm `leaves.view` sem `view_clinical`; coluna na UI | Alto | Query condicional + UI |
| O5 | Prontuário sem permissão por módulo | **CONFIRMADA** | `[id]/page.tsx` só `employees.view` e carrega ASOs/leaves/vacinas/etc. | Crítico | Gate por módulo |
| O6 | Sync por imports.create | **CONFIRMADA** | `syncAlterdataMirrorAction` → `imports.create`; COORDENACAO tem `imports: [view,create]` | Alto | Restringir SUPER_ADMIN/ADMIN_CENTRAL + lock |
| O7 | Sync Serverless insegura p/ 14k | **CONFIRMADA** | `getDb()` neon-http; N queries/row; sem lock; sem transação global | Alto | Preferir `sync:mirror:fast` local; lock; job |
| O8 | XLSX ocupacional não idempotente | **CONFIRMADA** | `import-occupational-data.ts` insert sem upsert/chave natural | Alto | Upsert + hash + preview |
| O9 | Boolean(PEP) errado | **CONFIRMADA** | `Boolean(cell(row, "PEP"))` em import-occupational | Médio | `parseBooleanPtBr` |
| O10 | Vacinas → 1 dose + obs | **CONFIRMADA** | loop grava `doseNumber: 1`, `notes: value` | Médio | Parser por vacina |
| O11 | Fluxo ASO incompleto | **CONFIRMADA** | só `createAsoAction` + lista; nextAso a partir de expected/performed | Médio | Distinguir previsto/realizado |
| O12 | Agenda incompleta | **CONFIRMADA** | só create; unique physician+slot com physician null | Médio | Fluxos + regra null |
| O13 | Afastamentos só cadastro | **CONFIRMADA** | só create; sem prorrogação/retorno | Médio | Fluxo continuidade |
| O14 | Vacinação parcial | **CONFIRMADA** | create dose; sem Anti-HBs/recusa UI | Médio | Completar módulo |
| O15 | Gestantes só create | **CONFIRMADA** | create + alerta dashboard | Médio | Histórico realocação |
| O16 | Bio sem transação | **PARCIALMENTE CONFIRMADA** | create acidente + 3 followups em loop sem BEGIN; se falhar no meio fica órfão | Alto | Transação única |
| O17 | Arquivos sem rota download | **CONFIRMADA** | `storePrivateAttachment` existe; sem `api/files/[id]` | Alto | Rota autenticada |
| O18 | Indicadores ≠ 43 | **CONFIRMADA** | seed ~9 códigos em `indicators.ts` | Médio | Catálogo completo + cálculo |
| O19 | Dashboard só cards; pendingReturns=0 | **CONFIRMADA** | `pendingReturns: 0` hardcoded | Médio | Query real ou remover card |
| O20 | Admin incompleto; mustReset unused | **CONFIRMADA** | admin só regions/units; `mustResetPassword` no schema, não no login flow | Médio | UI users + enforce |
| O21 | Auditoria parcial / swallow | **PARCIALMENTE CONFIRMADA** | writeAuditLog try/catch vazio; sem tela | Médio | Tela + alertas |
| O22 | CPF hash SHA-256 | **PARCIALMENTE CONFIRMADA** | funciona; HMAC seria melhor; sem rotação | Médio | Plano migrate HMAC |
| O23 | role_permissions DB vs TS | **CONFIRMADA** | `can()` usa só `ROLE_PERMISSIONS`; tabela `auth.role_permissions` sem uso | Médio | Uma fonte de verdade |
| O24 | Relatórios truncam 5k | **CONFIRMADA** | `.limit(5000)` sem aviso | Médio | Avisar / streaming |
| O25 | Health só env | **CONFIRMADA** | `/api/health` não testa Neon | Baixo | Ping DB opcional |
| O26 | Docs desatualizados | **CONFIRMADA** | ARCHITECTURE diz Neon pendente; CHANGELOG diz conectado | Baixo | Atualizar docs |
| — | Listagens com escopo | **JÁ CORRETA** | `listEmployees`/`listAsos`/etc. usam `employeeScopeCondition` | — | Manter |
| — | Espelho só leitura Google | **JÁ CORRETA** | apenas GET CSV | — | Manter |
| — | Auth cookie httpOnly | **JÁ CORRETA** | `session.ts` | — | Manter |

---

## Detalhamento Etapa 1 (amostra crítica)

### O2 — Escopo em mutações — CONFIRMADA

**Arquivos:** `src/db/queries/occupational.ts` (`findEmployeeIdByRegistration`), `src/actions/occupational.ts` (`resolveEmployee`), `src/actions/employees.ts` (`upsertEmployeeAction`, `softDeleteEmployeeAction`), `src/actions/indicators.ts`

**Evidência:** `findEmployeeIdByRegistration` filtra só por `registration` + `deleted_at`, sem `employeeScopeCondition`. Todas as creates usam `resolveEmployee(matrícula)`. Update de colaborador busca por `id` sem scope.

**Impacto:** operador/coordenação pode alterar dados de outra regional informando matrícula/ID.

**Risco:** Crítico | **Migration:** não | **Dados existentes:** não | **Prioridade:** P0

### O3 — Dashboard — CONFIRMADA

**Arquivo:** `src/db/queries/dashboard.ts`

**Evidência:** parâmetro `user` não entra em nenhum `where` além do early-return. Contagens são globais EMSERH.

**Risco:** Crítico | **Prioridade:** P0

### O4 — CID — CONFIRMADA

**Arquivos:** `listLeaves` seleciona `cidCode`; `afastamentos/page.tsx` coluna CID; matriz: ADMIN_CENTRAL/COORD/OPERADOR têm `leaves` sem `view_clinical` (só MEDICO tem).

**Risco:** Alto | **Prioridade:** P0

### O5 — Prontuário — CONFIRMADA

**Arquivo:** `colaboradores/[id]/page.tsx` linhas 27–84: um `requirePermission("employees","view")` e Promise.all em 6 módulos.

**Risco:** Crítico | **Prioridade:** P0

### O6 — Sync — CONFIRMADA

**Arquivos:** `mirror-sync.ts` action; `ROLE_PERMISSIONS.COORDENACAO_REGIONAL.imports = [view, create]`

**Risco:** Alto | **Prioridade:** P0

### O7 — Sync 14k — CONFIRMADA

HTTP neon por query; script `sync-alterdata-mirror-fast.ts` mitiga parcialmente. Sem lock concorrente.

**Risco:** Alto | **Prioridade:** P0 (lock + restringir) / P1 (job durável)

---

## Plano de correção

### P0 — Segurança e autorização (implementar agora)
1. `requireEmployeeInUserScope` centralizado em mutações
2. Escopo SQL no dashboard
3. Gates por módulo no prontuário + CID/`view_clinical`
4. Sync só SUPER_ADMIN/ADMIN_CENTRAL + lock concorrente
5. Remover ID do espelho do código commitado (só env)

### P1 — Integridade e importação
- Transação bio followups; idempotência XLSX; parseBooleanPtBr; parser vacinas; sync por job/lotes

### P2 — Fluxos operacionais
- ASO/agenda/afastamentos/vacinas/gestantes/bio completos; arquivos download

### P3 — Indicadores e dashboard
- 43 indicadores; gráficos; pendingReturns real; metas

### P4 — Admin, auditoria, observabilidade
- Usuários UI; mustResetPassword; tela auditoria; health DB; docs; security headers

## Impacto no banco

| Item | Tipo |
|------|------|
| P0 escopo/CID/sync | **Somente código** |
| Lock sync | Tabela `files.sync_locks` **ou** advisory lock — preferir advisory (sem migration) |
| Remover sheet id do repo | Código + env Vercel (já existe) |
| HMAC CPF | Migration futura expand/contract — **não** nesta rodada |

## Veredito

As observações do chat **fazem sentido na maioria dos pontos de segurança (O2–O7, O4, O5)**. Algumas sobre “módulo incompleto” (O11–O15, O18–O20) estão **corretas mas são expectativa de MVP ampliado**, não bugs de segurança.

**Não exagerado:** escopo em mutações, dashboard global, prontuário aberto, CID exposto, sync ampla.

**Já correto:** listagens com escopo; espelho read-only; auth básica; flags de regra pendente.

**Corrigir imediatamente:** apenas P0 listado acima.

---

*Próximo passo deste documento: marcar itens P0 como corrigidos após commits.*

---

## Atualização pós-P0 (2026-07-16)

| Item P0 | Status |
|---------|--------|
| `requireEmployeeInUserScope` nas mutações | **Corrigido** |
| Escopo SQL no dashboard | **Corrigido** (`pendingReturns` agora consulta `requires_return_aso`) |
| Gates por módulo no prontuário | **Corrigido** |
| CID / `view_clinical` | **Corrigido** |
| Sync só SUPER_ADMIN/ADMIN_CENTRAL (`sync_global`) | **Corrigido** |
| Lock concorrente de sync | **Corrigido** |
| Sheet ID só via env | **Corrigido** |

Pendentes (fora de P0): fluxos clínicos completos, XLSX idempotente, parser PEP/vacinas, indicadores 43, admin de usuários, rota de arquivos, etc.
