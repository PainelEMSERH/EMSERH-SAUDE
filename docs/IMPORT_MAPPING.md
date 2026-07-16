# Mapeamento de importação

Fonte: planilha **Oeste e Sul Gestão de enfermagem**.

| Aba | Destino principal |
|-----|-------------------|
| Extração Alterdata | `core.employees` + lotação + status ASO auxiliar |
| Alterdata Sul | idem (regional Sul) |
| ASO 2026 | `occupational.aso_records` |
| Agenda Médica 2026 / Atendimento 2025 | `occupational.appointments` |
| Afastados | `occupational.leave_records` + CID |
| Vacinas | `occupational.employee_vaccinations` |
| Gestantes | `occupational.pregnancy_cases` |
| Material Biológico | `occupational.biological_accidents` + follow-ups |
| Atend. Externo | `occupational.external_attendances` |

## Regras

- Idempotência por matrícula + chaves naturais + hash do lote.
- Preservar `source_sheet` / `source_row`.
- Não sobrescrever clínico recente com dado antigo.
- Normalizar regional (`CENTRO`/`CENTRAL` → `CENTRAL`).
- Confirmação explícita no terminal antes de gravar.
- Relatório de erros fora do repositório.

## Scripts

```bash
npm run import:employees -- --file ./caminho.xlsx
npm run import:occupational -- --file ./caminho.xlsx
npm run import:indicators -- --file ./caminho.xlsx
```
