-- EP1 Cerebro: memories and memory_audit
CREATE TYPE IF NOT EXISTS memory_scope AS ENUM ('agent_managed','user_owned');
CREATE TYPE IF NOT EXISTS memory_layer AS ENUM ('context','temporary','permanent');

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  scope memory_scope NOT NULL,
  layer memory_layer NOT NULL,
  key text NOT NULL,
  attribute text,
  detail text,
  tags jsonb DEFAULT '[]',
  content jsonb NOT NULL,
  token_cost int DEFAULT 0,
  confidence double precision DEFAULT 0.0,
  used_in_responses int DEFAULT 0,
  access_count int DEFAULT 0,
  needs_review boolean DEFAULT false,
  schema_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mem_owner_scope_layer ON memories (owner_id, scope, layer);
CREATE INDEX IF NOT EXISTS idx_mem_owner_key ON memories (owner_id, key);
CREATE INDEX IF NOT EXISTS idx_mem_expires ON memories (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS memories_tags_gin ON memories USING GIN (tags jsonb_path_ops);
CREATE INDEX IF NOT EXISTS memories_content_gin ON memories USING GIN (content jsonb_path_ops);

CREATE TABLE IF NOT EXISTS memory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  actor_id text,
  action text NOT NULL,
  entity_id uuid,
  entity_key text,
  scope memory_scope,
  layer memory_layer,
  before jsonb,
  after jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_audit_owner_created ON memory_audit (owner_id, created_at DESC);
