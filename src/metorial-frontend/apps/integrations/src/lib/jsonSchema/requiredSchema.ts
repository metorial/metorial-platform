import type { JsonSchema } from './types';

export let extractRequiredSchema = (schema: { type: string; schema: unknown }) =>
  schema.type === 'required' ? (schema.schema as JsonSchema) : null;

export let hasSchemaFields = (schema: JsonSchema | null | undefined) =>
  !!schema && Object.keys(schema.properties ?? {}).length > 0;
