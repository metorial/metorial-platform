export let normalizeJsonSchema = ({ schema }: { schema: any }) => {
  if (!schema) return null;

  if (schema.type == 'object' && Object.keys(schema.properties || {}).length === 0) {
    return null;
  }

  return schema;
};
