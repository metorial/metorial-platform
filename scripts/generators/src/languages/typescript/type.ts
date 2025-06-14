import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';
import { format } from '../../format';

export let generateTypeFromIntrospectedType = async (name: string, type: IntrospectedType) => {
  return (await format(`export type ${name} = ${processType(type)};\n\n`)) + '\n';
};

let wrapType = (type: IntrospectedType, processed: string) => {
  if (type.optional && type.nullable) {
    return `${processed} | null | undefined`;
  } else if (type.optional) {
    return `${processed} | undefined`;
  } else if (type.nullable) {
    return `${processed} | null`;
  }

  return processed;
};

let processType = (type: IntrospectedType): string => {
  switch (type.type) {
    case 'object':
      return wrapType(type, objectType(type));
    case 'enum':
      return wrapType(type, enumType(type));
    case 'string':
      return wrapType(type, stringType(type));
    case 'number':
      return wrapType(type, numberType(type));
    case 'boolean':
      return wrapType(type, booleanType(type));
    case 'date':
      return wrapType(type, dateType(type));
    case 'array':
      return wrapType(type, arrayType(type));
    case 'any':
      return wrapType(type, 'any');
    case 'record':
      return wrapType(type, recordType(type));
    case 'union':
      return `(${wrapType(type, unionType(type))})`;
    case 'intersection':
      return `(${wrapType(type, intersectionType(type))})`;
    case 'literal':
      return wrapType(type, literalType(type));
  }

  throw new Error(`Unknown type: ${type.type}`);
};

let addParenthesesIfNeeded = (type: IntrospectedType, processed: string): string => {
  if (processed.includes('|') || processed.includes('&')) {
    return `(${processed})`;
  }

  return processed;
};

let enumType = (type: IntrospectedType): string =>
  type.examples.map(e => `'${e}'`).join(' | ');
let stringType = (type: IntrospectedType): string => 'string';
let numberType = (type: IntrospectedType): string => 'number';
let booleanType = (type: IntrospectedType): string => 'boolean';
let dateType = (type: IntrospectedType): string => 'Date';
let literalType = (type: IntrospectedType): string => `'${type.examples[0]}'`;
let recordType = (type: IntrospectedType): string =>
  `Record<string, ${processType(type.items![0])}>`;
let arrayType = (type: IntrospectedType): string =>
  `${addParenthesesIfNeeded(type, processType(type.items![0]))}[]`;
let objectType = (type: IntrospectedType): string => {
  let props = new Set<string>();

  let properties = Object.entries(type.properties!)
    .map(([key, value]) => {
      key = Cases.toCamelCase(key);

      if (props.has(key) || props.has(`${key}s`) || props.has(key.slice(0, -1)))
        return undefined!;

      props.add(key);

      return `${key}${value.optional ? '?' : ''}: ${processType(value)}`;
    })
    .filter(Boolean);

  return `{ ${properties.join(', ')} }`;
};
let unionType = (type: IntrospectedType): string => {
  let processedTypes = type.items!.map(t => processType(t));

  return processedTypes.join(' | ');
};
let intersectionType = (type: IntrospectedType): string => {
  let processedTypes = type.items!.map(t => processType(t));
  return processedTypes.join(' & ');
};
