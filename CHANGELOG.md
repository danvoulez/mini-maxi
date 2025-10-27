# Changelog — minicontratos-mini-main

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
