-- Enable pgvector and add embedding column for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE memories
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for L2 distance (requires pgvector >= 0.5.0)
CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw ON memories
USING hnsw (embedding vector_l2_ops);
