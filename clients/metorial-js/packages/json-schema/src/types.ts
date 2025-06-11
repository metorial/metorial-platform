export interface JsonSchemaBase {
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  title?: string;
  description?: string;
  default?: any;
  examples?: any[];
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
}

export interface JsonSchemaString extends JsonSchemaBase {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  enum?: string[];
  const?: string;
}

export interface JsonSchemaNumber extends JsonSchemaBase {
  type: 'number' | 'integer';
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  enum?: number[];
  const?: number;
}

export interface JsonSchemaBoolean extends JsonSchemaBase {
  type: 'boolean';
  enum?: boolean[];
  const?: boolean;
}

export interface JsonSchemaArray extends JsonSchemaBase {
  type: 'array';
  items?: JsonSchema | JsonSchema[];
  additionalItems?: JsonSchema | boolean;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  contains?: JsonSchema;
}

export interface JsonSchemaObject extends JsonSchemaBase {
  type: 'object';
  properties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema | boolean;
  required?: string[];
  propertyNames?: JsonSchema;
  minProperties?: number;
  maxProperties?: number;
  dependencies?: Record<string, JsonSchema | string[]>;
  patternProperties?: Record<string, JsonSchema>;
}

export interface JsonSchemaNull extends JsonSchemaBase {
  type: 'null';
}

export interface JsonSchemaComposite extends JsonSchemaBase {
  type?: never;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
}

export type JsonSchema =
  | JsonSchemaString
  | JsonSchemaNumber
  | JsonSchemaBoolean
  | JsonSchemaArray
  | JsonSchemaObject
  | JsonSchemaNull
  | JsonSchemaComposite
  | boolean;
