-- Ledger tables
CREATE TABLE IF NOT EXISTS "Ledger_ObjectType" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "schema" jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_ledger_objecttype_name" ON "Ledger_ObjectType" ("name");

CREATE TABLE IF NOT EXISTS "Ledger_Object" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "typeId" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "metadata" jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ledger_object_type" ON "Ledger_Object" ("typeId");
CREATE INDEX IF NOT EXISTS "idx_ledger_object_created" ON "Ledger_Object" ("createdAt");
CREATE INDEX IF NOT EXISTS "idx_ledger_object_data_gin" ON "Ledger_Object" USING GIN ("data");

CREATE TABLE IF NOT EXISTS "Ledger_Transaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "objectId" uuid NOT NULL,
  "operationType" varchar(16) NOT NULL,
  "previousData" jsonb,
  "newData" jsonb NOT NULL,
  "createdBy" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ledger_tx_object" ON "Ledger_Transaction" ("objectId");
CREATE INDEX IF NOT EXISTS "idx_ledger_tx_created" ON "Ledger_Transaction" ("createdAt");

CREATE TABLE IF NOT EXISTS "Ledger_Log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "level" varchar(16) NOT NULL,
  "message" text NOT NULL,
  "context" jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ledger_log_level" ON "Ledger_Log" ("level");
CREATE INDEX IF NOT EXISTS "idx_ledger_log_created" ON "Ledger_Log" ("createdAt");
