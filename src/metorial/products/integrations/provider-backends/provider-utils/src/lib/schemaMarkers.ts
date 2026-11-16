export let SCHEMA_MARKER_PREFIX = 'x-metorial-';
export let SELECTION_OPTIONS_SCHEMA_MARKER = 'x-metorial-options';
export let EVENT_ATTRIBUTE_SCHEMA_MARKER = 'x-metorial-event-attribute';

export let isJsonObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Under these keywords the keys are field names or data, not schema keywords.
let NAMED_SCHEMAS = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
  'dependentSchemas'
]);
let DATA_KEYWORDS = new Set(['default', 'const', 'enum', 'examples']);

export let withoutSchemaKeys = <T>(schema: T, isRemoved: (key: string) => boolean): T => {
  let visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isJsonObject(value)) return value;

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isRemoved(key))
        .map(([key, child]) => {
          if (DATA_KEYWORDS.has(key)) return [key, child];
          if (NAMED_SCHEMAS.has(key) && isJsonObject(child)) {
            return [
              key,
              Object.fromEntries(
                Object.entries(child).map(([name, named]) => [name, visit(named)])
              )
            ];
          }
          return [key, visit(child)];
        })
    );
  };

  return visit(schema) as T;
};
