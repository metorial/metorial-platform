export interface JsonSchemaProperty {
  id: string;
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

  // Object properties
  properties?: { [key: string]: JsonSchemaProperty };

  // Array properties
  items?: JsonSchemaProperty;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface JsonSchema {
  $schema?: string;
  type: 'object';
  title?: string;
  description?: string;
  properties: { [key: string]: JsonSchemaProperty };
  required: string[];
}
