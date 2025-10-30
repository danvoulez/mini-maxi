# API Documentation

Complete API reference for minicontratos-mini application endpoints.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.vercel.app`

## Authentication

Most endpoints require authentication via NextAuth session cookie.

```typescript
// Authenticated requests automatically include session cookie
// No additional headers required when using the browser
```

For API clients:
```typescript
// Include session token in requests
headers: {
  'Cookie': 'next-auth.session-token=...'
}
```

## Response Format

### Success Response
```json
{
  "data": { ... },
  "success": true
}
```

### Error Response
```json
{
  "error": "error_type",
  "message": "Human-readable error message",
  "details": { ... } // Optional additional details
}
```

## Rate Limiting

Rate limits are applied per endpoint:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 1 minute |
| Chat | 30 requests | 1 minute |
| API (general) | 100 requests | 1 minute |
| Expensive (RAG, embeddings) | 20 requests | 1 minute |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
Retry-After: 60
```

---

## Health Check

### GET /ping

Health check endpoint for monitoring.

**Authentication**: None required

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T08:00:00.000Z",
  "version": "3.1.0"
}
```

**Status Codes**:
- `200`: Service healthy

---

## Memory API (CEREBRO)

### POST /api/memory/context

Retrieve working set of memories for current context.

**Authentication**: Required

**Request Body**:
```json
{
  "chatId": "uuid-v4",
  "maxTokens": 2000
}
```

**Response**:
```json
{
  "memories": [
    {
      "id": "uuid-v4",
      "key": "user:123:preference:theme",
      "content": { "theme": "dark" },
      "layer": "temporary",
      "confidence": 0.9,
      "createdAt": "2025-10-30T08:00:00.000Z"
    }
  ],
  "totalTokens": 1234,
  "count": 5
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid request
- `401`: Unauthorized
- `429`: Rate limit exceeded

---

### POST /api/memory/upsert

Create or update a memory.

**Authentication**: Required

**Request Body**:
```json
{
  "key": "user:123:preference:theme",
  "content": { "theme": "dark" },
  "layer": "temporary",
  "confidence": 0.9,
  "sensitivity": "public",
  "ttlMinutes": 10080,
  "tags": ["preference", "ui"]
}
```

**Response**:
```json
{
  "memory": {
    "id": "uuid-v4",
    "key": "user:123:preference:theme",
    "content": { "theme": "dark" },
    "layer": "temporary",
    "confidence": 0.9,
    "createdAt": "2025-10-30T08:00:00.000Z"
  }
}
```

**Field Descriptions**:
- `key`: Unique identifier (max 255 chars)
- `content`: JSON object (max 1MB)
- `layer`: `context` | `temporary` | `permanent`
- `confidence`: 0.0 to 1.0
- `sensitivity`: `public` | `confidential` | `secret` | `pii`
- `ttlMinutes`: Optional, overrides layer default
- `tags`: Optional array of strings

**Status Codes**:
- `200`: Memory created/updated
- `400`: Validation error
- `401`: Unauthorized
- `409`: Conflict (key exists in different layer)

---

### POST /api/memory/promote

Promote memory from temporary to permanent.

**Authentication**: Required

**Request Body**:
```json
{
  "key": "user:123:preference:theme",
  "force": false,
  "merge": false
}
```

**Response**:
```json
{
  "memory": {
    "id": "uuid-v4",
    "key": "user:123:preference:theme",
    "layer": "permanent",
    "promotedAt": "2025-10-30T08:00:00.000Z"
  }
}
```

**Status Codes**:
- `200`: Memory promoted
- `400`: Validation error or promotion rules not met
- `403`: Insufficient permissions
- `404`: Memory not found

---

### POST /api/memory/delete

Delete memory by key or ID.

**Authentication**: Required

**Request Body**:
```json
{
  "key": "user:123:preference:theme"
}
```

Or:
```json
{
  "id": "uuid-v4"
}
```

**Response**:
```json
{
  "deleted": true,
  "key": "user:123:preference:theme"
}
```

**Status Codes**:
- `200`: Memory deleted
- `400`: Validation error
- `403`: Insufficient permissions
- `404`: Memory not found

---

### POST /api/memory/search

Search memories by content, tags, or filters.

**Authentication**: Required

**Request Body**:
```json
{
  "query": "user preferences",
  "layer": "temporary",
  "tags": ["preference"],
  "minConfidence": 0.7,
  "limit": 10
}
```

**Response**:
```json
{
  "memories": [
    {
      "id": "uuid-v4",
      "key": "user:123:preference:theme",
      "content": { "theme": "dark" },
      "confidence": 0.9,
      "relevanceScore": 0.85
    }
  ],
  "total": 1
}
```

**Status Codes**:
- `200`: Search completed
- `400`: Invalid query
- `401`: Unauthorized

---

### POST /api/memory/rag

Retrieve external knowledge via RAG.

**Authentication**: Required

**Request Body**:
```json
{
  "query": "What are the best practices for React hooks?",
  "hints": {
    "context": "React development",
    "userLevel": "intermediate"
  },
  "maxResults": 5
}
```

**Response**:
```json
{
  "results": [
    {
      "content": "Best practices for React hooks...",
      "source": "vectorDB",
      "confidence": 0.92,
      "metadata": {
        "url": "https://example.com/article",
        "title": "React Hooks Guide"
      }
    }
  ],
  "degraded": false,
  "cached": false
}
```

**Status Codes**:
- `200`: RAG completed (may be degraded)
- `400`: Invalid request
- `503`: Service unavailable (circuit breaker open)

---

### GET /api/memory/metrics

Get CEREBRO system metrics and health.

**Authentication**: Required (admin role)

**Response**:
```json
{
  "metrics": {
    "cacheHitRatioL1": 0.85,
    "cacheHitRatioL2": 0.65,
    "avgLatencyMs": {
      "p95": 45,
      "p99": 78
    },
    "totalMemories": {
      "context": 120,
      "temporary": 450,
      "permanent": 89
    }
  },
  "alerts": [
    {
      "type": "high_latency",
      "threshold": 100,
      "current": 78
    }
  ],
  "config": {
    "tokenBudget": 2000,
    "ttls": {
      "context": 15,
      "temporary": 10080
    }
  }
}
```

**Status Codes**:
- `200`: Metrics retrieved
- `403`: Insufficient permissions

---

## Chat API

### POST /api/chat

Stream chat completion with AI.

**Authentication**: Required

**Request Body**:
```json
{
  "id": "uuid-v4",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "modelId": "gpt-4-turbo"
}
```

**Response**: Server-Sent Events (SSE) stream

```
event: message
data: {"type":"text","content":"Hello!"}

event: message
data: {"type":"text","content":" I'm doing well."}

event: done
data: {"usage":{"tokens":150}}
```

**Status Codes**:
- `200`: Stream started
- `400`: Invalid request
- `401`: Unauthorized
- `429`: Rate limit exceeded

---

## Ledger API

### POST /api/ledger/objects

Create or query ledger objects.

**Authentication**: Required

**Request Body** (Create):
```json
{
  "typeName": "contract",
  "data": {
    "title": "Service Agreement",
    "amount": 10000,
    "currency": "USD"
  }
}
```

**Response**:
```json
{
  "object": {
    "id": "uuid-v4",
    "typeName": "contract",
    "data": { ... },
    "createdAt": "2025-10-30T08:00:00.000Z",
    "createdBy": "user-id"
  }
}
```

**Status Codes**:
- `200`: Object created
- `400`: Validation error
- `401`: Unauthorized

---

### POST /api/ledger/transactions

Create transaction in ledger.

**Authentication**: Required

**Request Body**:
```json
{
  "objectId": "uuid-v4",
  "action": "update",
  "data": {
    "status": "signed"
  },
  "metadata": {
    "ip": "127.0.0.1",
    "userAgent": "..."
  }
}
```

**Response**:
```json
{
  "transaction": {
    "id": "uuid-v4",
    "objectId": "uuid-v4",
    "action": "update",
    "createdAt": "2025-10-30T08:00:00.000Z",
    "createdBy": "user-id"
  }
}
```

**Status Codes**:
- `200`: Transaction created
- `400`: Validation error
- `401`: Unauthorized
- `404`: Object not found

---

### GET /api/ledger/aggregates

Get aggregated ledger statistics.

**Authentication**: Required

**Query Parameters**:
- `typeName`: Filter by object type
- `from`: Start date (ISO 8601)
- `to`: End date (ISO 8601)

**Response**:
```json
{
  "aggregates": {
    "totalObjects": 150,
    "totalTransactions": 450,
    "byType": {
      "contract": 100,
      "invoice": 50
    },
    "byStatus": {
      "active": 120,
      "completed": 30
    }
  }
}
```

**Status Codes**:
- `200`: Aggregates retrieved
- `401`: Unauthorized

---

## File API

### POST /api/files/upload

Upload file to Vercel Blob storage.

**Authentication**: Required

**Request**: Multipart form data

```typescript
const formData = new FormData();
formData.append('file', file);
```

**Response**:
```json
{
  "url": "https://blob.vercel-storage.com/...",
  "pathname": "file.pdf",
  "contentType": "application/pdf",
  "size": 102400
}
```

**Limits**:
- Max file size: 50MB
- Supported types: PDF, images, text files

**Status Codes**:
- `200`: File uploaded
- `400`: Invalid file or size exceeded
- `401`: Unauthorized

---

## History API

### GET /api/history

Get chat history for current user.

**Authentication**: Required

**Query Parameters**:
- `limit`: Max results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response**:
```json
{
  "chats": [
    {
      "id": "uuid-v4",
      "title": "React Development Questions",
      "createdAt": "2025-10-30T08:00:00.000Z",
      "messageCount": 15,
      "visibility": "private"
    }
  ],
  "total": 42,
  "hasMore": true
}
```

**Status Codes**:
- `200`: History retrieved
- `401`: Unauthorized

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Request validation failed |
| `bad_request` | 400 | Malformed request |
| `authentication_error` | 401 | Not authenticated |
| `authorization_error` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Resource conflict |
| `rate_limit_exceeded` | 429 | Too many requests |
| `internal_error` | 500 | Server error |
| `database_error` | 500 | Database operation failed |
| `external_api_error` | 502 | External service failed |

---

## SDK Examples

### TypeScript/JavaScript

```typescript
// Memory API
async function createMemory() {
  const response = await fetch('/api/memory/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: 'user:pref:theme',
      content: { theme: 'dark' },
      layer: 'temporary',
      confidence: 0.9,
    }),
  });
  
  const data = await response.json();
  return data.memory;
}

// Chat API with streaming
async function streamChat(messages: Message[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const text = decoder.decode(value);
    console.log(text);
  }
}
```

---

## Webhooks (Future)

Webhook support is planned for future releases to enable:
- Memory promotion notifications
- Chat completion events
- Ledger transaction events

---

## Versioning

API versioning will be introduced in future releases. Currently, all endpoints are v1 (implicit).

---

## Support

For API questions or issues:
- GitHub Issues: [repository issues](https://github.com/danvoulez/mini-maxi/issues)
- Documentation: See README.md and module-specific docs

---

Last Updated: 2025-10-30
