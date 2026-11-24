export let omitFixedAuthInput = <T>(
  schema: T,
  fixedInput: Record<string, string> | null | undefined
): T => {
  let fixedKeys = Object.keys(fixedInput ?? {});
  if (!fixedKeys.length || !schema || typeof schema !== 'object') return schema;

  let { properties, required, ...rest } = schema as {
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  if (!properties) return schema;

  return {
    ...rest,
    properties: Object.fromEntries(
      Object.entries(properties).filter(([key]) => !fixedKeys.includes(key))
    ),
    ...(required ? { required: required.filter(key => !fixedKeys.includes(key)) } : {})
  } as T;
};
