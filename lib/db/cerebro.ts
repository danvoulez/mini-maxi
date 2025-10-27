import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const memoryScope = pgEnum("memory_scope", [
  "agent_managed",
  "user_owned",
]);
export const memoryLayer = pgEnum("memory_layer", [
  "context",
  "temporary",
  "permanent",
]);

export const memories = pgTable("memories", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  ownerId: text("owner_id").notNull(),
  scope: memoryScope("scope").notNull(),
  layer: memoryLayer("layer").notNull(),
  key: text("key").notNull(),
  attribute: text("attribute"),
  detail: text("detail"),
  tags: jsonb("tags")
    .$type<string[]>()
    .default([] as any),
  content: jsonb("content").notNull(),
  tokenCost: integer("token_cost").default(0),
  confidence: doublePrecision("confidence").default(0),
  usedInResponses: integer("used_in_responses").default(0),
  accessCount: integer("access_count").default(0),
  needsReview: integer("needs_review")
    .$type<boolean>()
    .default(false as any),
  schemaId: text("schema_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const memoryAudit = pgTable("memory_audit", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  ownerId: text("owner_id").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityId: uuid("entity_id"),
  entityKey: text("entity_key"),
  scope: memoryScope("scope"),
  layer: memoryLayer("layer"),
  before: jsonb("before"),
  after: jsonb("after"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MemoryRow = typeof memories.$inferSelect;
