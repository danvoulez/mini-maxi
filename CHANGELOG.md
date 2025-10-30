# Changelog — minicontratos-mini-main

## [3.2.0 - Premium A++ Enhancements] – 2025-10-30

### Added - Infrastructure & DevOps 🚀
- **Docker Development Environment**: Full Docker Compose setup with PostgreSQL (pgvector), Redis, and optional pgAdmin
- **Feature Flags System**: Dynamic feature toggling with percentage rollouts, user targeting, and A/B testing support
- **Comprehensive Logging**: Structured logging framework with multiple levels, context propagation, and external service integration
- **Rate Limiting**: Token bucket rate limiting with presets for auth, API, chat, and expensive operations
- **Error Handling**: Centralized error handling with AppError class, error factories, and retry mechanisms

### Added - Testing & Quality 🧪
- **Test Utilities**: Comprehensive testing helpers including mocks, fixtures, and assertions
- **Unit Tests**: Test suites for rate limiting and error handling modules
- **Performance Monitoring**: Web Vitals tracking, resource timing, and custom performance measurements

### Added - Documentation 📚
- **API Documentation**: Complete API reference with examples, status codes, and SDK usage
- **Security Policy (SECURITY.md)**: Comprehensive security guidelines, vulnerability reporting, and compliance information
- **Contributing Guide (CONTRIBUTING.md)**: Development setup, code style, commit conventions, and testing guidelines
- **Docker Guide (DOCKER_GUIDE.md)**: Full Docker development workflow and troubleshooting
- **Architecture Decision Records (ADRs)**: Framework for documenting architectural decisions with template and examples

### Added - Developer Experience 🛠️
- **Pre-commit Hooks**: Automated linting and formatting before commits
- **Conventional Commits**: Commitlint configuration for standardized commit messages
- **Lint-staged**: Auto-formatting on staged files
- **Enhanced VS Code Config**: Improved settings with Tailwind CSS support, spell checking, and 14 recommended extensions

### Fixed - Code Quality 🔧
- Fixed React hooks exhaustive dependencies warnings in auth pages (login.tsx, register.tsx)

### Changed
- Enhanced VS Code workspace with Tailwind CSS IntelliSense, code spell checker, and improved TypeScript settings
- Improved file exclusions for cleaner search and better performance

---

## [3.1.0 - Previous Release]

## [UI Rich Rendering] – Added
- Enhanced **Response** renderer with:
  - **Shiki** syntax highlighting (light/dark auto).
  - Header bar with language + **Copy** button for each code block.
  - Polished **tables** (zebra rows, spacing, borders).
  - Inline `code` styling.
  - Works with **Streamdown** (streaming): uses MutationObserver to progressively enhance.
- File: `components/elements/response.tsx`

## [RAG Driver] – Added
- Pluggable **RAGManager** with providers:
  - `pgIlike` (default) over `memories`.
  - `vectorDB` (stub) ready for pgvector/Qdrant/Pinecone.
- Env: `RAG_PROVIDER=pgIlike`
- File: `lib/memory/rag-manager.ts`

## [Workflows] – Added
- **Deploy** (previously added): migrate → build → deploy → smoke `/ping`.
  - File: `.github/workflows/deploy.yml`
- **Manual DB Migrate** (new):
  - Trigger via `workflow_dispatch`, supports `dryRun`.
  - File: `.github/workflows/migrate-manual.yml`

## [Security & Hardening] – Changed
- Force **`ownerId = session.user.id`** in memory routes; ignore body.ownerId.
- Force **`createdBy = session.user.id`** in ledger transactions; ignore body.createdBy.
- Auto `requestId` (server-side) via `crypto.randomUUID()` when absent.
- Global **security headers** via `middleware.ts`:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 0` (obsolete header disabled)
- Pin **Next.js** to stable (removed canary suffix).

## [CEREBRO & APIs] – Changed
- **Zod** validation added to mutating endpoints:
  - `app/(chat)/api/memory/{context,promote,delete,rag}/route.ts`
  - `app/(chat)/api/ledger/{objects,transactions}/route.ts`
- **Chat** route set to no-cache: `export const dynamic = "force-dynamic"`.

## [DB] – Added
- Indexes for **CEREBRO** performance:
  - `lib/db/migrations/0010_cerebro_indexes.sql`

## [Ops] – Added
- Health check route: `GET /ping` (edge, no-cache).
- `.env.example` normalized and deduplicated (AI/DB/Auth/KMS/CEREBRO/RAG).  
- `package.json` engines: `"node": ">=20 <23"`.

---

### Notes
- To switch RAG provider: set `RAG_PROVIDER=pgIlike | vectorDB`.
- The **vectorDB** driver is a stub; integrate pgvector/Qdrant/Pinecone by implementing `search()`.
- The UI enhancer runs entirely client-side and is compatible com streaming.

## [UI — Extras] – Added
- **Code actions:** Copiar / Baixar / Expandir.
- **Tema por bloco:** alterna Light/Dark independente do tema global.
- **Números de linha** nos blocos de código.
