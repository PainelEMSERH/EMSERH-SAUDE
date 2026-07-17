# Módulo de Gestão de ASOs

Painel operacional em `/asos` para planejamento mensal, execução e conciliação com o espelho Alterdata (somente leitura).

## Fórmula de aderência

```
realizados_validos ÷ previstos_elegiveis × 100
```

- Numerador e denominador são sempre exibidos.
- Consolidado EMSERH é **ponderado** (`soma realizados / soma elegíveis`), nunca média simples de percentuais.
- Status institucional da regra: `PENDENTE_VALIDACAO` (a planilha sugeria a divisão invertida).

## Colunas do espelho Alterdata (inspecionadas)

| Cabeçalho real | Uso |
|----------------|-----|
| `Proximo_aso` | Snapshot / planejamento periódico |
| `Data_Atestado` | Último ASO observado |
| `Status_ASO` | Situação auxiliar (não define sozinho a situação funcional) |
| `Periodicidade` | Ciclo em meses (aceita quirk Excel `11/01/1900` → 11) |

Aliases aceitos após inspeção: `Data Proximo ASO`, `Proximo ASO`, `Data_Atestado_(2026)`.

## Planilha oficial ASO 2026

GID de referência: `547708498` (variáveis `ASO_OFFICIAL_SHEET_ID` / `ASO_OFFICIAL_SHEET_GID`).

A aba acessível é **lista nominal** (matrícula, próximo ASO, tipo, férias, afastamento etc.).  
**Não** contém matriz institucional de metas mensais importável automaticamente.

Metas no sistema: configuradas em `/asos` com auditoria (`aso_targets` + `aso_target_history`). Não inventar valores.

## Tabelas novas (migration `0001_aso_management`)

- `occupational.aso_monthly_plans`
- `occupational.aso_alterdata_snapshots` (append-only)
- `occupational.aso_targets` / `aso_target_history`
- `occupational.aso_competence_closures`
- Colunas aditivas em `aso_records`: `region_id`, `plan_id`, `origin`

## Operação

1. Aplicar migration: `npm run db:migrate:prod`
2. Sincronizar Alterdata (grava snapshots quando `Proximo_aso`/`Status_ASO` mudam)
3. Gerar planejamento do ano
4. Registrar realizações pela relação nominal
5. Conciliação compara snapshots anteriores × posteriores à data realizada

## Separação planejamento × realização

- Só data prevista → planejamento (não avança `last_aso_date` / ciclo)
- Data realizada → `last_aso_date` + próximo ciclo por meses reais
