# Minicontratos Mini — Chat + CEREBRO (Memória & RAG) — Production Template

Uma base **pronta para produção** que combina **Next.js (App Router)**, **Vercel AI SDK**, **Tailwind + shadcn/ui** e o sistema de memória/RAG **CEREBRO**.
Entrega chat *streaming* com **renderização rica**, memória persistente, RAG textual e **RAG vetorial (pgvector)**, além de **CI/CD** com smoke test.

> Ideal para apps de IA que precisam de contexto duradouro, APIs robustas e UX premium dentro do chat.

## ✨ Destaques
- **Chat moderno** (Next.js + Vercel AI SDK) com streaming e UI premium:
  - Realce de sintaxe com **Shiki** (tema claro/escuro), **números de linha**, **Copiar**, **Baixar**, **Expandir**, **tema por bloco**.
  - Tabelas com zebra e tipografia legível, `code` inline estilizado.
  - **Reasoning colapsável** (```reasoning).
  - **Cards inteligentes** (```card-contract, ```card-customer) com ações; **mini-formulários** inline (```form-schedule).
- **CEREBRO**: memórias `context/temporary/permanent`, **audit trail append-only**, **RBAC**, **criptografia seletiva**, **Schema Registry (Zod)**, **cache L1/L2**, **autotuner**, métricas.
- **RAG pluggável**: `pgIlike` (texto) ou **`vectorDB` (pgvector real)** com **HNSW**. *Circuit breaker* + cache curto.
- **APIs com validação** (Zod) e **hardening**:
  - `ownerId` **forçado no servidor** (ignora o do body).
  - `createdBy` **forçado em transações do ledger**.
  - **Security headers** globais via `middleware.ts`.
- **DevOps**: GitHub Actions para **migrar → buildar → deployar (Vercel) → smoke test `/ping`** e **workflow manual de migração**.
- **DB**: Drizzle + Postgres, migrations organizadas, **pgvector** opcional.

---

## 🧭 Estrutura (pastas principais)
```
app/
  (chat)/api/chat/route.ts       # chat streaming (dynamic = "force-dynamic")
  (chat)/api/memory/*            # APIs do CEREBRO (Zod + hardening)
  (chat)/api/ledger/*            # APIs do ledger (Zod + createdBy do servidor)
  ping/route.ts                  # healthcheck (edge, no-cache)
components/
  elements/response.tsx          # renderer rico (Shiki, cards, forms, reasoning)
lib/
  ai/tools/cerebro.ts            # ferramentas do LLM para operar memória
  db/migrations/                 # migrations (inclui pgvector)
  memory/                        # MemoryManager, RAGManager, embeddings, etc.
  jobs/reindex-memories.ts       # job p/ gerar embeddings pendentes
.github/workflows/
  deploy.yml                     # migrate → build → deploy → smoke test
  migrate-manual.yml             # migração manual (workflow_dispatch)
```

---

## 🚀 Quickstart (local)
### Requisitos
- **Node 22**, **pnpm 9**
- **Postgres** (Neon / Vercel / local)
- (Opcional p/ RAG vetorial) **pgvector** habilitado

### 1) Configurar variáveis
Copie `.env.example` para `.env.local` e ajuste:
```
# Banco / Drizzle
POSTGRES_URL=postgres://...

# Auth
AUTH_SECRET=...

# OpenAI (LLM e embeddings)
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# CEREBRO / RAG
RAG_PROVIDER=pgIlike     # ou vectorDB para pgvector
REDIS_URL=...            # opcional (cache L2)
```

### 2) Instalar & migrar
```bash
pnpm install
pnpm db:migrate
```

### 3) Rodar dev
```bash
pnpm dev
# http://localhost:3000
```

### 4) (Opcional) RAG vetorial
Habilite `vector` no Postgres e gere embeddings:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
```bash
pnpm db:reindex:memories
# gera embeddings p/ memories com embedding IS NULL
```

> Se o provider for `vectorDB`, certifique-se de ter `OPENAI_API_KEY` válido e `OPENAI_EMBEDDING_MODEL` compatível (1536 dims por padrão).

---

## 🧠 CEREBRO (memória & APIs)
- **Camadas**: `context` (sessão atual), `temporary`, `permanent`.
- **Validação**: Zod em todas as rotas mutantes.
- **Segurança**:
  - O servidor **ignora `ownerId` do body** e usa `session.user.id`.
  - Em `ledger/transactions`, o **`createdBy`** também é definido pelo servidor.
  - **Audit trail**: todas as operações registradas (append-only).
  - **Criptografia seletiva** (AES-256-GCM) para campos sensíveis.
- **Rotas** (principais):
  - `/api/memory/context` — monta conjunto de trabalho.
  - `/api/memory/promote` — promove memórias.
  - `/api/memory/delete` — remove por id/chave.
  - `/api/memory/rag` — busca (texto/vetor).
  - `/api/chat` — chat streaming (sem cache).
  - `/ping` — health check JSON.

---

## 🔎 RAG pluggável
- `RAG_PROVIDER=pgIlike` — busca textual (LIKE) em `memories`.
- `RAG_PROVIDER=vectorDB` — **pgvector** real com **HNSW**.
  - Migration: `0011_pgvector_memories_embedding.sql` adiciona `embedding vector(1536)` + índice.
  - **Job**: `pnpm db:reindex:memories` gera embeddings pendentes (OpenAI Embeddings API).
- **Circuit breaker** + cache de 15s = resiliência e latência previsível.

---

## 🎨 UI rica no chat
- **Code blocks**: Shiki (VS Code themes), números de linha, Copiar, Baixar `.txt`, Expandir/Recolher, **tema por bloco**.
- **Tabelas**: zebra + tipografia legível.
- **Reasoning**:
  ```
  ```reasoning
  passo 1...
  passo 2...
  ```
  ```
- **Cards** (ex.: contrato):
  ```
  ```card-contract
  { "id":"C-1029","title":"Contrato VV","amount":12000,"currency":"EUR","customerName":"Empresa X","dueDate":"2025-11-01","status":"ativo" }
  ```
  ```
  - Emite evento `chat-action` no `window` (ex.: `{ action:"contract.edit", payload:{ id:"C-1029" } }`).
- **Mini-form agendamento**:
  ```
  ```form-schedule
  { "title":"Agendar follow-up","initialDate":"2025-11-05","initialTime":"14:30","meta":{"customerId":"CL-22"} }
  ```
  ```
  - Emite `chat-form-submit` (`{ kind:"schedule", date, time, meta }`) e `chat-form-cancel`.

> Veja `components/elements/response.tsx` para os *enhancers* e os eventos emitidos.

---

## 🛡️ Segurança & Boas Práticas
- **Não** rodar migrations no **build** do Vercel.
- `ownerId` e `createdBy` **sempre** do `session.user.id` no servidor.
- **Security headers** no `middleware.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- **Rotação de segredos** (Auth/DB/KMS/OpenAI).
- **Backups** do Postgres + teste periódico de restore.

---

## 🛠️ Dev & Ops
### Scripts
```json
{
  "db:migrate": "drizzle-kit migrate",
  "db:check": "drizzle-kit check",
  "db:reindex:memories": "tsx lib/jobs/reindex-memories.ts",
  "build": "next build",
  "dev": "next dev"
}
```
> Os nomes exatos podem variar no seu `package.json`, mas os comandos acima existem no projeto.

### GitHub Actions
- `.github/workflows/deploy.yml` — **migrate → build → deploy (Vercel) → smoke `/ping`**  
  **Secrets** exigidos:
  - `POSTGRES_URL`
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `.github/workflows/migrate-manual.yml` — migração manual (`workflow_dispatch` + `dryRun`).

### Vercel
- **Build Command**: `pnpm build`
- **Node.js Version**: `22`
- **Env Vars**: mantenha as mesmas do `.env.local`.

---

## 🧩 Solução de problemas
- **pgvector não disponível**: use `pgIlike` ou habilite `CREATE EXTENSION vector;` (alguns provedores exigem plano pago p/ HNSW).
- **Embeddings falham**: verifique `OPENAI_API_KEY`, cota e **dimensão** (`text-embedding-3-small` = 1536).
- **403 nas rotas**: verifique autenticação (`auth()`) e sessão.
- **Edge cache**: `/api/chat` e `/ping` estão sem cache (`dynamic = "force-dynamic"`).
- **Node mismatch**: Vercel configurado para **Node 22**; local idem.

---

## 🗺️ Roadmap (sugestões)
- Handlers globais para eventos `chat-action`/`chat-form-*` (abrir Drawer/Modal).
- Mais **cards** (ledger-tx, invoice) e **forms** (contato, projeto).
- RAG externo (web, parceiros) com **citations** e limites de custo.
- Painel de **observabilidade** (métricas + traces) e **admin** de memória.

---

## 📄 Licença
Defina a licença que preferir (ex.: MIT).

---

### Créditos
Baseado no template Next.js AI + extensões próprias do **CEREBRO** (memória, RAG, segurança e UX). Obrigado às libs **shiki**, **drizzle-orm**, **postgres.js**, **tailwind/shadcn**, **Vercel AI SDK**.
