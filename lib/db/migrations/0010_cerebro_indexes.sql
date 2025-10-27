-- Cerebro indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_owner_scope_layer_exp
  ON memories (owner_id, scope, layer, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_owner_key
  ON memories (owner_id, key);
