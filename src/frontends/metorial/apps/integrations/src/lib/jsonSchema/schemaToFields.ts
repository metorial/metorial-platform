import type { FieldDefinition, JsonSchema, JsonSchemaProperty } from './types';

export let schemaToFields = (schema: JsonSchema): FieldDefinition[] => {
  if (!schema.properties) {
    return [];
  }

  let fields: FieldDefinition[] = [];
  let requiredFields = schema.required || [];

  for (let [key, prop] of Object.entries(schema.properties)) {
    let field = propertyToField(key, prop, requiredFields.includes(key));
    if (field) {
      fields.push(field);
    }
  }

  return fields;
};

let propertyToField = (
  key: string,
  prop: JsonSchemaProperty,
  isRequired: boolean
): FieldDefinition | null => {
  let base = {
    key,
    label: prop.title || formatLabel(key),
    description: prop.description,
    defaultValue: prop.default,
    required: isRequired
  };

  if (prop.enum && prop.enum.length > 0) {
    return {
      ...base,
      type: 'select',
      options: prop.enum.map(v => ({ value: String(v), label: String(v) }))
    };
  }

  if (prop.type === 'string') {
    return {
      ...base,
      type: getStringFieldType(prop),
      placeholder: prop.description
    };
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    return {
      ...base,
      type: 'number',
      inputProps: {
        min: prop.minimum,
        max: prop.maximum,
        step: prop.type === 'integer' ? 1 : 'any'
      }
    };
  }

  if (prop.type === 'boolean') {
    return {
      ...base,
      type: 'checkbox'
    };
  }

  return null;
};

let getStringFieldType = (prop: JsonSchemaProperty): FieldDefinition['type'] => {
  if (prop.format === 'email') {
    return 'email';
  }
  if (prop.format === 'uri' || prop.format === 'url') {
    return 'url';
  }
  if (prop.format === 'password') {
    return 'password';
  }
  if (prop.maxLength && prop.maxLength > 200) {
    return 'textarea';
  }
  return 'text';
};

let formatLabel = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
};
