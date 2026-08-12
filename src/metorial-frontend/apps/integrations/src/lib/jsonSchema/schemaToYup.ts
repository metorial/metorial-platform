import * as yup from 'yup';
import type { JsonSchema, JsonSchemaProperty } from './types';

export let schemaToYup = (schema: JsonSchema): yup.ObjectSchema<Record<string, unknown>> => {
  if (!schema.properties) {
    return yup.object().shape({});
  }

  let shape: Record<string, yup.Schema> = {};
  let requiredFields = schema.required || [];

  for (let [key, prop] of Object.entries(schema.properties)) {
    let fieldSchema = propertyToYup(prop);

    if (requiredFields.includes(key)) {
      fieldSchema = fieldSchema.required(`${prop.title || key} is required`);
    }

    shape[key] = fieldSchema;
  }

  return yup.object().shape(shape);
};

let propertyToYup = (prop: JsonSchemaProperty): yup.Schema => {
  if (prop.type === 'string') {
    return stringPropertyToYup(prop);
  }
  if (prop.type === 'number' || prop.type === 'integer') {
    return numberPropertyToYup(prop);
  }
  if (prop.type === 'boolean') {
    return yup.boolean();
  }
  if (prop.type === 'array') {
    return arrayPropertyToYup(prop);
  }
  if (prop.type === 'object') {
    return objectPropertyToYup(prop);
  }
  return yup.mixed();
};

let stringPropertyToYup = (prop: JsonSchemaProperty): yup.StringSchema => {
  let schema = yup.string();

  if (prop.format === 'email') {
    schema = schema.email('Must be a valid email');
  }
  if (prop.format === 'uri' || prop.format === 'url') {
    schema = schema.url('Must be a valid URL');
  }
  if (prop.minLength) {
    schema = schema.min(prop.minLength, `Must be at least ${prop.minLength} characters`);
  }
  if (prop.maxLength) {
    schema = schema.max(prop.maxLength, `Must be at most ${prop.maxLength} characters`);
  }
  if (prop.pattern) {
    schema = schema.matches(new RegExp(prop.pattern), 'Invalid format');
  }
  if (prop.enum) {
    schema = schema.oneOf(prop.enum as string[], 'Must be one of the allowed values');
  }

  return schema;
};

let numberPropertyToYup = (prop: JsonSchemaProperty): yup.NumberSchema => {
  let schema = yup.number();

  if (prop.type === 'integer') {
    schema = schema.integer('Must be a whole number');
  }
  if (prop.minimum !== undefined) {
    schema = schema.min(prop.minimum, `Must be at least ${prop.minimum}`);
  }
  if (prop.maximum !== undefined) {
    schema = schema.max(prop.maximum, `Must be at most ${prop.maximum}`);
  }

  return schema;
};

let arrayPropertyToYup = (prop: JsonSchemaProperty): yup.Schema => {
  let itemSchema = prop.items ? propertyToYup(prop.items) : yup.mixed();
  return yup.array().of(itemSchema);
};

let objectPropertyToYup = (prop: JsonSchemaProperty): yup.ObjectSchema<Record<string, unknown>> => {
  if (!prop.properties) {
    return yup.object();
  }
  return schemaToYup(prop as JsonSchema);
};
