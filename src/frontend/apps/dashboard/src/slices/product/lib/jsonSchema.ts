import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

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

let isJsonSchemaObjectDefinition = (
  value: JSONSchema7Definition
): value is JSONSchema7 => typeof value === 'object' && value !== null;

let cloneJsonSchemaDefault = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneJsonSchemaDefault);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonSchemaDefault(entry)])
    );
  }

  return value;
};

let inferJsonSchemaDefault = (
  schema: JSONSchema7,
  forceObjectPresence = false
): { hasValue: boolean; value: unknown } => {
  if (schema.default !== undefined) {
    return { hasValue: true, value: cloneJsonSchemaDefault(schema.default) };
  }

  if (schema.type !== 'object' && !schema.properties) {
    return { hasValue: false, value: undefined };
  }

  let required = schema.required ?? [];
  let value: Record<string, unknown> = {};

  for (let [key, property] of Object.entries(schema.properties ?? {})) {
    if (!isJsonSchemaObjectDefinition(property)) continue;

    let inferred = inferJsonSchemaDefault(property, required.includes(key));
    if (inferred.hasValue) value[key] = inferred.value;
  }

  if (Object.keys(value).length === 0 && !forceObjectPresence) {
    return { hasValue: false, value: undefined };
  }

  return { hasValue: true, value };
};

let areJsonSchemaRequiredFieldsDefaultSatisfied = (schema: JSONSchema7): boolean => {
  if (schema.default !== undefined) return true;
  if (schema.type !== 'object' && !schema.properties) return false;

  let properties = schema.properties ?? {};

  for (let requiredKey of schema.required ?? []) {
    let property = properties[requiredKey];
    if (!property || !isJsonSchemaObjectDefinition(property)) return false;
    if (property.default !== undefined) continue;

    if (
      (property.type === 'object' || property.properties) &&
      areJsonSchemaRequiredFieldsDefaultSatisfied(property)
    ) {
      continue;
    }

    return false;
  }

  return true;
};

export let getJsonSchemaDefaultObject = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
): Record<string, unknown> => {
  let schema = getJsonSchemaObject(value);
  if (!schema) return {};

  let inferred = inferJsonSchemaDefault(schema, true);

  if (inferred.value && typeof inferred.value === 'object' && !Array.isArray(inferred.value)) {
    return inferred.value as Record<string, unknown>;
  }

  return {};
};

export let areJsonSchemaRequiredFieldsDefaulted = (
  value: JsonSchemaEnvelope | Record<string, unknown> | null | undefined
) => {
  let schema = getJsonSchemaObject(value);
  if (!schema) return true;

  return areJsonSchemaRequiredFieldsDefaultSatisfied(schema);
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
