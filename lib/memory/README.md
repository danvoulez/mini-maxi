# CEREBRO Memory System

CEREBRO is a comprehensive memory and knowledge management system for AI agents, implementing hierarchical memory layers, RAG capabilities, security, and auto-optimization.

## Architecture

### Memory Layers

- **Context Layer**: Short-lived (15 minutes) - Session-specific temporary data
- **Temporary Layer**: Medium-lived (7 days) - Working memory with promotion capabilities
- **Permanent Layer**: Long-lived (infinite) - Core knowledge and validated facts

### Key Features

#### EP1 - Foundation
- ✅ PostgreSQL-backed persistent storage
- ✅ L1 (in-memory) and L2 (Redis) caching
- ✅ Token budget management
- ✅ Working set retrieval with smart ranking

#### EP2 - Security
- ✅ RBAC with roles: admin, user, agent, system
- ✅ Selective encryption (AES-256-GCM) for PII/secrets
- ✅ Append-only audit trail
- ✅ KMS integration ready

#### EP3 - Quality
- ✅ Schema validation with auto-detection
- ✅ Memory promotion workflow (temporary → permanent)
- ✅ NeedsReview flag and confidence scoring
- ✅ Semantic and key-based search

#### EP4 - RAG
- ✅ Multi-source retrieval (vectorDB, webSearch, internalDocs, partnerAPIs)
- ✅ Circuit breaker pattern for resilience
- ✅ Fallback mechanisms and degraded mode
- ✅ Result caching and drift detection

#### EP5 - Auto-Optimization
- ✅ Metrics collection (latency, cache hits, operations)
- ✅ Auto-tuner for cache sizing and TTL adjustment
- ✅ Guardrails and automatic rollback
- ✅ Alert detection (high latency, low hit ratio, RAG failures)

## Usage

### API Routes

#### Get Working Set
```typescript
POST /api/memory/context
{
  "ownerId": "user-123",
  "maxTokens": 2000,
  "tags": ["project:X"]
}
```

#### Upsert Memory
```typescript
POST /api/memory/upsert
{
  "ownerId": "user-123",
  "scope": "agent_managed",
  "layer": "temporary",
  "key": "user:123:preference:theme",
  "content": { "theme": "dark" },
  "confidence": 0.9,
  "tags": ["preference"],
  "sensitivity": "public"
}
```

#### Promote Memory
```typescript
POST /api/memory/promote
{
  "ownerId": "user-123",
  "key": "user:123:preference:theme",
  "reason": "User confirmed preference"
}
```

#### Search Memory
```typescript
POST /api/memory/search
{
  "ownerId": "user-123",
  "query": "preference",
  "layer": "permanent",
  "minConfidence": 0.7
}
```

#### RAG Retrieve
```typescript
POST /api/memory/rag
{
  "query": "What is the latest feature in React 19?",
  "hints": { "domain": "frontend" }
}
```

#### Get Metrics
```typescript
GET /api/memory/metrics
```

### Programmatic Usage

```typescript
import { MemoryManager, RAGManager, getMetricsCollector } from "@/lib/memory";

// Get working set
const mgr = new MemoryManager(process.env.POSTGRES_URL!);
const workingSet = await mgr.getWorkingSet({
  ownerId: "user-123",
  maxTokens: 2000,
});

// Upsert memory
await mgr.upsertMemory({
  ownerId: "user-123",
  scope: "user_owned",
  layer: "temporary",
  key: "project:456:architecture:backend",
  content: { type: "microservices" },
  confidence: 0.85,
});

// Promote to permanent
await mgr.promote({
  ownerId: "user-123",
  key: "project:456:architecture:backend",
  force: false,
  actorRole: "user",
});

// RAG retrieval
const rag = new RAGManager();
const result = await rag.retrieve("latest React features");

// Check metrics
const metrics = getMetricsCollector();
const p95Latency = metrics.getP95("memory_get_workingset_latency_ms");
const alerts = metrics.checkAlerts();
```

### AI Tools Integration

```typescript
import { cerebroTools } from "@/lib/ai/tools/cerebro";

// Use in AI SDK
const result = await generateText({
  model: yourModel,
  tools: cerebroTools,
  prompt: "Remember that the user prefers dark mode",
});
```

## Background Jobs

The system includes maintenance jobs:

```typescript
import { CerebroJobs } from "@/lib/memory";

const jobs = new CerebroJobs(process.env.POSTGRES_URL!);

// Run expire sweep (hourly recommended)
await jobs.expireSweep();

// Run drift detection (every 6 hours)
await jobs.driftDetection();

// Generate optimizer report (daily)
await jobs.optimizerReport();

// Backup permanent memories (daily)
await jobs.backupPermanent();

// Run all jobs
await jobs.runAllJobs();
```

## Configuration

Environment variables:

```bash
# Database
POSTGRES_URL=postgresql://...

# Redis (optional, for L2 cache)
REDIS_URL=redis://...

# Token budgets
CEREBRO_TOKEN_BUDGET_TOTAL=2000
CEREBRO_TOKEN_BUDGET_MODEL_RESERVE=512

# TTLs
CEREBRO_TTL_CONTEXT_MINUTES=15
CEREBRO_TTL_TEMPORARY_DAYS=7

# Encryption (optional)
KMS_KEY_PII=your-pii-encryption-key
KMS_KEY_SECRET=your-secret-encryption-key
KMS_KEY_CONFIDENTIAL=your-confidential-encryption-key
```

## Key Conventions

Memory keys follow the pattern: `{scope}:{entity}:{id}:{attribute}:{detail}`

Examples:
- `user:123:preference:theme`
- `project:456:architecture:backend`
- `org:789:policy:code_review`
- `session:abc:context:current_file`

## Schema Validation

Automatic schema detection based on key patterns:
- `user:*:preference:*` → UserPreferenceSchema
- `project:*:architecture:*` → ArchitectureSchema
- `org:*:policy:*` → PolicySchema
- `session:*:context:*` → ContextSchema

## Observability

Metrics tracked:
- Cache hit/miss rates (L1, L2)
- Operation latencies (get, upsert, promote)
- Operation counts
- RAG metrics (triggers, fallbacks, errors)
- Memory layer usage
- Validation errors

Alerts triggered on:
- High latency (P95 > 250ms)
- Low L2 hit ratio (< 40%)
- High RAG fallback rate (> 10%)

## Auto-Optimization

The AutoTuner automatically:
- Adjusts cache sizes based on hit rates
- Tunes TTLs based on access patterns
- Modifies promotion thresholds based on review backlog
- Rolls back changes if degradation detected

## Security

- RBAC: Four roles (admin, user, agent, system) with granular permissions
- Encryption: Selective encryption for PII, secrets, and confidential data
- Audit: All operations logged to append-only audit table
- Validation: Schema validation prevents invalid data

## License

Part of the minicontratos-mini project.
