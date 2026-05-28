import { JSONSchema7 } from 'json-schema';

export type JsonSchemaEnvelope = {
  type: 'json_schema';
  schema: Record<string, unknown> | null;
};

export type JsonSchemaValue = JSONSchema7;
export type JsonSchemaObject = JSONSchema7 & {
  type?: 'object';
  properties?: Record<string, JSONSchema7>;
};

export let isJsonSchemaEnvelope = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
): value is JsonSchemaEnvelope => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      value.type === 'json_schema' &&
      'schema' in value
  );
};

export let getJsonSchema = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
): JsonSchemaValue | null => {
  if (!value) return null;
  if (isJsonSchemaEnvelope(value)) return (value.schema as JsonSchemaValue | null) ?? null;
  return value as JsonSchemaValue;
};

export let getJsonSchemaObject = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
): JsonSchemaObject | null => {
  let schema = getJsonSchema(value);
  if (!schema || typeof schema !== 'object') return null;
  if (schema.type && schema.type !== 'object') return null;
  return schema as JsonSchemaObject;
};

export let hasJsonSchemaProperties = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
) => {
  let schema = getJsonSchema(value);
  if (!schema || typeof schema !== 'object') return false;

  let properties =
    'properties' in schema && schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : null;

  return Boolean(properties && Object.keys(properties).length > 0);
};

export let hasRequiredJsonSchemaFields = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
) => {
  let schema = getJsonSchema(value);
  if (!schema || typeof schema !== 'object') return false;

  if (schema.type === 'object' && schema.properties) {
    let required = schema.required ?? [];
    return required.length > 0;
  }

  return true;
};
