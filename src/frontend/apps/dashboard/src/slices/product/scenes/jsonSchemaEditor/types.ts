export interface JsonSchemaProperty {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  required: boolean;
  description?: string;
  default?: any;
  enum?: any[];

  // String validations
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number validations
  minimum?: number;
  maximum?: number;
  multipleOf?: number;

  // // Object properties
  // properties?: { [key: string]: JsonSchemaProperty };

  // // Array properties
  // items?: JsonSchemaProperty;
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

let propertyToJsonSchema = (property: JsonPropertyStored): any => {
  let result: any = {
    type: property.property.type,
    title: property.property.name,
    description: property.property.description,
    default: property.property.default,
    enum: property.property.enum
  };

  // String validations
  if (property.property.minLength !== undefined)
    result.minLength = property.property.minLength;
  if (property.property.maxLength !== undefined)
    result.maxLength = property.property.maxLength;
  if (property.property.pattern) result.pattern = property.property.pattern;
  if (property.property.format) result.format = property.property.format;

  // Number validations
  if (property.property.minimum !== undefined) result.minimum = property.property.minimum;
  if (property.property.maximum !== undefined) result.maximum = property.property.maximum;
  if (property.property.multipleOf !== undefined)
    result.multipleOf = property.property.multipleOf;

  // Object properties
  if (property.property.type === 'object' && property.children) {
    result.properties = {};
    for (let child of property.children.properties) {
      result.properties[child.property.name] = propertyToJsonSchema(child);
    }
    let requiredProps = property.children.properties
      .filter(p => p.property.required)
      .map(p => p.property.name);
    if (requiredProps.length > 0) {
      result.required = requiredProps;
    }
  }

  // Array properties
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

export let toJsonSchema = (schema: JsonSchema): any => {
  let schemaProperties: { [key: string]: JsonSchemaProperty } = {};

  for (let property of schema.children.properties) {
    schemaProperties[property.property.name] = propertyToJsonSchema(property);
  }

  let result: any = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: schema.title,
    description: schema.description,
    properties: schemaProperties,
    required: schema.children.properties
      .filter(p => p.property.required)
      .map(p => p.property.name)
  };

  return result;
};

let jsonSchemaToProperty = (jsonSchema: any): JsonPropertyStored => {
  let property: JsonSchemaProperty = {
    required: false,

    name: jsonSchema.title || '',
    type: jsonSchema.type,
    description: jsonSchema.description,
    default: jsonSchema.default,
    enum: jsonSchema.enum,

    // String validations
    minLength: jsonSchema.minLength,
    maxLength: jsonSchema.maxLength,
    pattern: jsonSchema.pattern,
    format: jsonSchema.format,

    // Number validations
    minimum: jsonSchema.minimum,
    maximum: jsonSchema.maximum,
    multipleOf: jsonSchema.multipleOf
  };

  let children: JsonPropertyList | undefined = undefined;

  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    children = {
      properties: Object.entries(jsonSchema.properties).map(([name, prop]) => {
        let childProperty = jsonSchemaToProperty(prop);
        childProperty.property.name = name;
        childProperty.property.required = jsonSchema.required
          ? jsonSchema.required.includes(name)
          : false;
        return childProperty;
      })
    };
  } else if (jsonSchema.type === 'array' && jsonSchema.items) {
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

export let fromJsonSchema = (jsonSchema: any): JsonSchema => {
  let properties: JsonPropertyStored[] = [];

  if (jsonSchema.properties) {
    properties = Object.entries(jsonSchema.properties).map(([name, prop]) => {
      let property = jsonSchemaToProperty(prop);
      property.property.name = name;
      property.property.required = jsonSchema.required
        ? jsonSchema.required.includes(name)
        : false;
      return property;
      return property;
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
