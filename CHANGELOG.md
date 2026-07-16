# Changelog

## 0.1.0 — 2026-07-16

### Added

- Scaffold Next.js 15 + TypeScript + Tailwind + shadcn/ui + Geist
- Modelagem Drizzle nos schemas `auth`, `core`, `occupational`, `files`, `reporting`, `audit`
- Autenticação por e-mail/senha com sessão JWT httpOnly, rate limit e auditoria de login
- RBAC com 8 perfis e ações granulares
- Layout institucional e rotas protegidas dos módulos operacionais
- Cliente Neon lazy (sem conexão no build)
- Scripts de admin/importação (preparados; execução após Neon)
- Documentação em `docs/`
