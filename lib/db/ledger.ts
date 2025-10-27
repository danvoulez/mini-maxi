import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// --- Ledger tables (standalone, no circular FK to User for simplicity) ---

export const objectType = pgTable("Ledger_ObjectType", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  schema: jsonb("schema"), // optional JSON schema per type
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ledgerObject = pgTable("Ledger_Object", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  typeId: uuid("typeId").notNull(),
  data: jsonb("data").notNull(),
  metadata: jsonb("metadata"),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const ledgerTransaction = pgTable("Ledger_Transaction", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  objectId: uuid("objectId").notNull(),
  operationType: varchar("operationType", { length: 16 }).notNull(), // CREATE / UPDATE / DELETE
  previousData: jsonb("previousData"),
  newData: jsonb("newData").notNull(),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LedgerObjectTypeRow = typeof objectType.$inferSelect;
export type LedgerObjectRow = typeof ledgerObject.$inferSelect;
export type LedgerTransactionRow = typeof ledgerTransaction.$inferSelect;
