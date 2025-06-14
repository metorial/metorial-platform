import { JsonSchema } from './types';

export interface OpenApiSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  example?: any;
  examples?: any[];
  enum?: any[];
  const?: any;

  // String-specific
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number-specific
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;

  // Array-specific
  items?: OpenApiSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Object-specific
  properties?: Record<string, OpenApiSchema>;
  additionalProperties?: OpenApiSchema | boolean;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;

  // Composition
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  not?: OpenApiSchema;

  // OpenAPI specific
  nullable?: boolean;
  discriminator?: {
    propertyName: string;
    mapping?: Record<string, string>;
  };
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
  };
  externalDocs?: {
    description?: string;
    url: string;
  };
  deprecated?: boolean;

  // Reference
  $ref?: string;
}

/**
 * Converts a JSON Schema to an OpenAPI Schema
 * @param jsonSchema - The JSON Schema to convert
 * @param options - Conversion options
 * @returns OpenAPI Schema
 */
export let jsonSchemaToOpenApi = (
  jsonSchema: JsonSchema,
  options: {
    /**
     * OpenAPI version to target (affects some conversion behaviors)
     * @default "3.0.0"
     */
    openApiVersion?: '3.0.0' | '3.1.0';

    /**
     * Whether to preserve JSON Schema specific keywords that aren't part of OpenAPI
     * @default false
     */
    preserveJsonSchemaKeywords?: boolean;

    /**
     * How to handle null types (JSON Schema allows type: null, OpenAPI uses nullable)
     * @default "nullable"
     */
    nullHandling?: 'nullable' | 'remove' | 'preserve';
  } = {}
): OpenApiSchema => {
  let {
    openApiVersion = '3.0.0',
    preserveJsonSchemaKeywords = false,
    nullHandling = 'nullable'
  } = options;

  // Handle boolean schemas
  if (typeof jsonSchema === 'boolean') {
    return jsonSchema ? {} : { not: {} };
  }

  // Handle $ref
  if (jsonSchema.$ref) {
    return {
      $ref: transformRef(jsonSchema.$ref)
    };
  }

  let result: OpenApiSchema = {};

  // Handle composition keywords
  if ('allOf' in jsonSchema && jsonSchema.allOf) {
    result.allOf = jsonSchema.allOf.map(schema => jsonSchemaToOpenApi(schema, options));
  }

  if ('anyOf' in jsonSchema && jsonSchema.anyOf) {
    result.anyOf = jsonSchema.anyOf.map(schema => jsonSchemaToOpenApi(schema, options));
  }

  if ('oneOf' in jsonSchema && jsonSchema.oneOf) {
    result.oneOf = jsonSchema.oneOf.map(schema => jsonSchemaToOpenApi(schema, options));
  }

  if ('not' in jsonSchema && jsonSchema.not) {
    result.not = jsonSchemaToOpenApi(jsonSchema.not, options);
  }

  // Handle type
  if (jsonSchema.type) {
    if (Array.isArray(jsonSchema.type)) {
      // JSON Schema allows array of types, OpenAPI doesn't
      let types = jsonSchema.type.filter(t => t !== 'null');
      let hasNull = jsonSchema.type.includes('null');

      if (types.length === 1) {
        result.type = types[0] as any;
        if (hasNull && nullHandling === 'nullable') {
          result.nullable = true;
        }
      } else if (types.length > 1) {
        // Convert to anyOf
        result.anyOf = types.map(type => ({ type: type as any }));
        if (hasNull && nullHandling === 'nullable') {
          result.nullable = true;
        }
      }
    } else if (jsonSchema.type === 'null') {
      if (nullHandling === 'nullable') {
        result.nullable = true;
      } else if (nullHandling === 'preserve') {
        result.type = 'null' as any;
      }
      // If nullHandling === 'remove', we don't set type
    } else {
      result.type = jsonSchema.type;
    }
  }

  // Copy common properties
  let commonProps = [
    'title',
    'description',
    'default',
    'enum',
    'const',
    'readOnly',
    'writeOnly',
    'deprecated'
  ] as const;

  for (let prop of commonProps) {
    // @ts-ignore
    if (jsonSchema[prop] !== undefined) (result as any)[prop] = jsonSchema[prop];
  }

  // Handle examples vs example
  if (jsonSchema.examples && jsonSchema.examples.length > 0) {
    if (openApiVersion === '3.1.0') {
      result.examples = jsonSchema.examples;
    } else {
      // OpenAPI 3.0 uses singular 'example'
      result.example = jsonSchema.examples[0];
    }
  }

  // Type-specific properties
  if (jsonSchema.type === 'string') {
    let stringProps = ['minLength', 'maxLength', 'pattern', 'format'] as const;
    stringProps.forEach(prop => {
      if (jsonSchema[prop] !== undefined) {
        (result as any)[prop] = jsonSchema[prop];
      }
    });
  }

  if (jsonSchema.type === 'number' || jsonSchema.type === 'integer') {
    let numericProps = ['minimum', 'maximum', 'multipleOf'] as const;
    numericProps.forEach(prop => {
      if (jsonSchema[prop] !== undefined) {
        (result as any)[prop] = jsonSchema[prop];
      }
    });

    // Handle exclusive minimum/maximum
    if (typeof jsonSchema.exclusiveMinimum === 'number') {
      result.minimum = jsonSchema.exclusiveMinimum;
      result.exclusiveMinimum = true;
    } else if (typeof jsonSchema.exclusiveMinimum === 'boolean') {
      result.exclusiveMinimum = jsonSchema.exclusiveMinimum;
    }

    if (typeof jsonSchema.exclusiveMaximum === 'number') {
      result.maximum = jsonSchema.exclusiveMaximum;
      result.exclusiveMaximum = true;
    } else if (typeof jsonSchema.exclusiveMaximum === 'boolean') {
      result.exclusiveMaximum = jsonSchema.exclusiveMaximum;
    }
  }

  if (jsonSchema.type === 'array') {
    let arrayProps = ['minItems', 'maxItems', 'uniqueItems'] as const;
    arrayProps.forEach(prop => {
      if (jsonSchema[prop] !== undefined) {
        (result as any)[prop] = jsonSchema[prop];
      }
    });

    if (jsonSchema.items) {
      if (Array.isArray(jsonSchema.items)) {
        // JSON Schema allows array of schemas for tuple validation
        // OpenAPI doesn't support this directly, so we use anyOf
        result.items = {
          anyOf: jsonSchema.items.map(item => jsonSchemaToOpenApi(item, options))
        };
      } else {
        result.items = jsonSchemaToOpenApi(jsonSchema.items, options);
      }
    }
  }

  if (jsonSchema.type === 'object') {
    let objectProps = ['required', 'minProperties', 'maxProperties'] as const;
    objectProps.forEach(prop => {
      if (jsonSchema[prop] !== undefined) {
        (result as any)[prop] = jsonSchema[prop];
      }
    });

    if (jsonSchema.properties) {
      result.properties = {};
      Object.entries(jsonSchema.properties).forEach(([key, schema]) => {
        result.properties![key] = jsonSchemaToOpenApi(schema, options);
      });
    }

    if (jsonSchema.additionalProperties !== undefined) {
      if (typeof jsonSchema.additionalProperties === 'boolean') {
        result.additionalProperties = jsonSchema.additionalProperties;
      } else {
        result.additionalProperties = jsonSchemaToOpenApi(
          jsonSchema.additionalProperties,
          options
        );
      }
    }
  }

  // Handle JSON Schema keywords that aren't in OpenAPI
  if (!preserveJsonSchemaKeywords) {
    // Remove JSON Schema specific keywords
    let jsonSchemaOnlyKeywords = [
      '$schema',
      '$id',
      '$defs',
      'definitions',
      'patternProperties',
      'dependencies',
      'propertyNames',
      'contains',
      'additionalItems',
      'if',
      'then',
      'else'
    ];

    jsonSchemaOnlyKeywords.forEach(keyword => {
      delete (result as any)[keyword];
    });
  }

  return result;
};

/**
 * Transforms JSON Schema $ref to OpenAPI compatible format
 */
function transformRef(ref: string): string {
  // JSON Schema often uses #/$defs/... while OpenAPI uses #/components/schemas/...
  if (ref.startsWith('#/$defs/')) {
    return ref.replace('#/$defs/', '#/components/schemas/');
  }

  if (ref.startsWith('#/definitions/')) {
    return ref.replace('#/definitions/', '#/components/schemas/');
  }

  return ref;
}
