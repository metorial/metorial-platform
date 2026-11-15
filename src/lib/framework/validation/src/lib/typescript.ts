import type { ValidationType } from './types';

let identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

let itemsOf = (type: ValidationType<any>) =>
  Array.isArray(type.items) ? type.items : type.items ? [type.items] : [];

let toBaseTypeScript = (type: ValidationType<any>): string => {
  switch (type.type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return type.type;

    case 'any':
      return 'unknown';

    case 'literal':
      return JSON.stringify(type.examples![0]);

    case 'enum':
      return type.examples!.map(value => JSON.stringify(value)).join(' | ');

    case 'array':
      return `Array<${toTypeScript(itemsOf(type)[0]!)}>`;

    case 'record':
      return `Record<string, ${toTypeScript(itemsOf(type)[0]!)}>`;

    case 'union':
      return `(${itemsOf(type).map(toTypeScript).join(' | ')})`;

    case 'intersection':
      return `(${itemsOf(type).map(toTypeScript).join(' & ')})`;

    case 'object':
      return `{ ${Object.entries(type.properties ?? {})
        .map(
          ([key, value]) =>
            `${identifierPattern.test(key) ? key : JSON.stringify(key)}${value.optional ? '?' : ''}: ${toTypeScript(value)}`
        )
        .join('; ')} }`;

    default:
      throw new Error(`Cannot convert validation type "${type.type}" to TypeScript`);
  }
};

export let toTypeScript = (type: ValidationType<any>): string => {
  let base = toBaseTypeScript(type);

  return type.nullable ? `(${base} | null)` : base;
};
