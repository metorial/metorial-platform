let toolCallAttachmentSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['url']
    },
    url: {
      type: 'string'
    },
    mimeType: {
      type: 'string'
    },
    urlExpiresAt: {
      type: 'string'
    }
  },
  required: ['type', 'url'],
  additionalProperties: false
};

type JsonSchema = Record<string, any>;

export let mcpOutputSchemaNormalizer = (
  schema: JsonSchema | undefined,
  opts: { isRoot?: boolean } = {}
): JsonSchema | undefined => {
  if (!schema || typeof schema !== 'object') return schema;

  if (schema.type === 'array') {
    return {
      ...schema,
      items: mcpOutputSchemaNormalizer(
        schema.items && typeof schema.items === 'object' ? schema.items : {},
        { isRoot: false }
      )
    };
  }

  if (schema.type !== 'object') return schema;

  let properties: Record<string, any> = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, value]) => [
      key,
      mcpOutputSchemaNormalizer(value as JsonSchema, { isRoot: false })
    ])
  );

  if (opts.isRoot && !properties.$attachments) {
    properties.$attachments = {
      type: 'array',
      items: toolCallAttachmentSchema
    };
  }

  return {
    ...schema,
    properties,
    additionalProperties: true
  };
};
