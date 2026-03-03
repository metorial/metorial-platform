export type JsonSchemaEnvelope = {
  type: 'json_schema';
  schema: Record<string, unknown> | null;
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
) => {
  if (!value) return null;
  if (isJsonSchemaEnvelope(value)) return value.schema ?? null;
  return value;
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
