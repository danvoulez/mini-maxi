// Schema Registry and Validation (EP3-Qualidade)
import { z } from "zod";

// Define schemas for different memory types
const UserPreferenceSchema = z.object({
  theme: z.string().optional(),
  language: z.string().optional(),
  notifications: z.boolean().optional(),
  value: z.any(),
});

const ArchitectureSchema = z.object({
  type: z.string(),
  components: z.array(z.string()).optional(),
  description: z.string().optional(),
  value: z.any(),
});

const PolicySchema = z.object({
  name: z.string(),
  rules: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  value: z.any(),
});

const ContextSchema = z.object({
  sessionId: z.string().optional(),
  currentFile: z.string().optional(),
  state: z.any().optional(),
  value: z.any(),
});

export type SchemaId =
  | "UserPreferenceSchema"
  | "ArchitectureSchema"
  | "PolicySchema"
  | "ContextSchema";

const SCHEMAS: Record<SchemaId, z.ZodSchema> = {
  UserPreferenceSchema,
  ArchitectureSchema,
  PolicySchema,
  ContextSchema,
};

// Pattern matching for auto-detection
const PATTERN_TO_SCHEMA: [RegExp, SchemaId][] = [
  [/^user:.*:preference:.*$/, "UserPreferenceSchema"],
  [/^project:.*:architecture:.*$/, "ArchitectureSchema"],
  [/^org:.*:policy:.*$/, "PolicySchema"],
  [/^session:.*:context:.*$/, "ContextSchema"],
];

export function detectSchemaId(key: string): SchemaId | null {
  for (const [pattern, schemaId] of PATTERN_TO_SCHEMA) {
    if (pattern.test(key)) {
      return schemaId;
    }
  }
  return null;
}

export function validateMemoryContent(
  content: any,
  schemaId?: SchemaId | null
): { valid: boolean; error?: string } {
  if (!schemaId) {
    return { valid: true }; // No schema, no validation
  }

  const schema = SCHEMAS[schemaId];
  if (!schema) {
    return { valid: false, error: `Unknown schema: ${schemaId}` };
  }

  try {
    schema.parse(content);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", "),
      };
    }
    return { valid: false, error: String(error) };
  }
}

export function getAvailableSchemas(): SchemaId[] {
  return Object.keys(SCHEMAS) as SchemaId[];
}
