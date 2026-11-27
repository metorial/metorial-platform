import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

type JsonSchemaPrimitive = string | number | boolean | null;
type JsonSchemaSerializable =
  | JsonSchemaPrimitive
  | { [key: string]: JsonSchemaSerializable }
  | JsonSchemaSerializable[];

export interface JsonSchemaProperty {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  required: boolean;
  description?: string;
  default?: unknown;
  enum?: JsonSchemaPrimitive[];

  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  minimum?: number;
  maximum?: number;
  multipleOf?: number;

  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface JsonPropertyStored {
  id: string;
  property: JsonSchemaProperty;
  children?: JsonPropertyList;
}

export interface JsonPropertyList {
  properties: JsonPropertyStored[];
}

export interface JsonSchema {
  title?: string;
  description?: string;
  children: JsonPropertyList;
}

let isJsonSchemaObject = (
  schema: JSONSchema7Definition | JSONSchema7Definition[] | undefined
): schema is JSONSchema7 =>
  !!schema && typeof schema === 'object' && !Array.isArray(schema);

let isJsonSchemaPrimitive = (value: unknown): value is JsonSchemaPrimitive =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

let isJsonSchemaSerializable = (value: unknown): value is JsonSchemaSerializable => {
  if (isJsonSchemaPrimitive(value)) return true;
  if (Array.isArray(value)) return value.every(isJsonSchemaSerializable);
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(isJsonSchemaSerializable);
};

let getPropertyType = (schema: JSONSchema7): JsonSchemaProperty['type'] => {
  let type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') {
    return type;
  }
  if (type === 'object' || schema.properties) return 'object';
  if (type === 'array' || schema.items) return 'array';
  if (type === 'null') return 'null';
  return 'string';
};

let propertyToJsonSchema = (property: JsonPropertyStored): JSONSchema7 => {
  let result: JSONSchema7 = {
    type: property.property.type,
    title: property.property.name
  };

  if (property.property.description !== undefined) result.description = property.property.description;
  if (
    property.property.default !== undefined &&
    isJsonSchemaSerializable(property.property.default)
  ) {
    result.default = property.property.default;
  }
  if (property.property.enum) result.enum = property.property.enum;

  if (property.property.minLength !== undefined) result.minLength = property.property.minLength;
  if (property.property.maxLength !== undefined) result.maxLength = property.property.maxLength;
  if (property.property.pattern) result.pattern = property.property.pattern;
  if (property.property.format) result.format = property.property.format;

  if (property.property.minimum !== undefined) result.minimum = property.property.minimum;
  if (property.property.maximum !== undefined) result.maximum = property.property.maximum;
  if (property.property.multipleOf !== undefined) result.multipleOf = property.property.multipleOf;

  if (property.property.type === 'object' && property.children) {
    let properties: Record<string, JSONSchema7Definition> = {};
    for (let child of property.children.properties) {
      properties[child.property.name] = propertyToJsonSchema(child);
    }
    result.properties = properties;

    let requiredProps = property.children.properties
      .filter(p => p.property.required)
      .map(p => p.property.name);
    if (requiredProps.length > 0) {
      result.required = requiredProps;
    }
  }

  if (property.property.type === 'array') {
    if (property.children && property.children.properties.length > 0) {
      result.items = propertyToJsonSchema(property.children.properties[0]);
    }
    if (property.property.minItems !== undefined) result.minItems = property.property.minItems;
    if (property.property.maxItems !== undefined) result.maxItems = property.property.maxItems;
    if (property.property.uniqueItems) result.uniqueItems = property.property.uniqueItems;
  }

  return result;
};

export let toJsonSchema = (schema: JsonSchema): JSONSchema7 => {
  let schemaProperties: Record<string, JSONSchema7Definition> = {};

  for (let property of schema.children.properties) {
    schemaProperties[property.property.name] = propertyToJsonSchema(property);
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: schema.title,
    description: schema.description,
    properties: schemaProperties,
    required: schema.children.properties.filter(p => p.property.required).map(p => p.property.name)
  };
};

let jsonSchemaToProperty = (jsonSchema: JSONSchema7): JsonPropertyStored => {
  let property: JsonSchemaProperty = {
    required: false,
    name: jsonSchema.title || '',
    type: getPropertyType(jsonSchema),
    description: jsonSchema.description,
    default: jsonSchema.default,
    enum: Array.isArray(jsonSchema.enum) ? jsonSchema.enum.filter(isJsonSchemaPrimitive) : undefined,
    minLength: jsonSchema.minLength,
    maxLength: jsonSchema.maxLength,
    pattern: jsonSchema.pattern,
    format: jsonSchema.format,
    minimum: jsonSchema.minimum,
    maximum: jsonSchema.maximum,
    multipleOf: jsonSchema.multipleOf
  };

  let children: JsonPropertyList | undefined;

  if (jsonSchema.properties) {
    children = {
      properties: Object.entries(jsonSchema.properties)
        .flatMap(([name, prop]) => {
          if (!isJsonSchemaObject(prop)) return [];
          let childProperty = jsonSchemaToProperty(prop);
          childProperty.property.name = name;
          childProperty.property.required = jsonSchema.required
            ? jsonSchema.required.includes(name)
            : false;
          return [childProperty];
        })
    };
  } else if (isJsonSchemaObject(jsonSchema.items)) {
    children = {
      properties: [jsonSchemaToProperty(jsonSchema.items)]
    };
  }

  return {
    id: getUniqueId(),
    property,
    children
  };
};

export let fromJsonSchema = (jsonSchema: JSONSchema7): JsonSchema => {
  let properties: JsonPropertyStored[] = [];

  if (jsonSchema.properties) {
    properties = Object.entries(jsonSchema.properties).flatMap(([name, prop]) => {
      if (!isJsonSchemaObject(prop)) return [];
      let property = jsonSchemaToProperty(prop);
      property.property.name = name;
      property.property.required = jsonSchema.required
        ? jsonSchema.required.includes(name)
        : false;
      return [property];
    });
  }

  return {
    title: jsonSchema.title,
    description: jsonSchema.description,
    children: {
      properties
    }
  };
};

export let createEmptyProperty = (
  name: string,
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
): JsonPropertyStored => {
  return {
    id: getUniqueId(),
    property: {
      name,
      type,
      required: false
    },
    children: type === 'object' ? { properties: [] } : undefined
  };
};

let idx = 0;
let getUniqueId = (): string => `${Date.now()}-${idx++}`;
