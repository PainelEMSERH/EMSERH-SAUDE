# RBAC

## Perfis

| Perfil | Escopo padrão |
|--------|----------------|
| SUPER_ADMIN | EMSERH |
| ADMIN_CENTRAL | EMSERH |
| COORDENACAO_REGIONAL | Regionais vinculadas |
| OPERADOR_UNIDADE | Unidades vinculadas |
| MEDICO_TRABALHO | Unidades/regionais vinculadas |
| ENFERMAGEM_TRABALHO | Unidades/regionais vinculadas |
| GESTOR_CONSULTA | EMSERH (leitura) |
| AUDITOR | EMSERH (leitura + auditoria) |

## Ações

`view`, `create`, `update`, `delete`, `export`, `manage`, `view_clinical`, `view_sensitive_identifiers`

## Regras

- Matriz em `src/lib/permissions/index.ts`.
- Toda mutação/consulta sensível usa `assertCan` no servidor.
- Escopo filtrado por `regionIds` / `unitIds`.
- Esconder botão no frontend nunca é suficiente.

## Dados sensíveis

- CPF/CNS: criptografados em repouso; hash para unicidade/busca.
- Exibição mascarada sem `view_sensitive_identifiers`.
- Notas clínicas exigem `view_clinical`.
- Nunca colocar CPF/CNS/CID em URL ou logs.
