import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';

export let getObjectProperties = (type: IntrospectedType, path: string) => {
  let targets = new Map<string, string>();
  let sources = new Map<string, string>();

  return Object.entries(type.properties ?? {}).map(([key, value]) => {
    let target = Cases.toCamelCase(key);
    let source = key === 'createdAt' ? 'created_at' : key === 'updatedAt' ? 'updated_at' : key;
    let previous = targets.get(target) ?? sources.get(source);

    if (previous !== undefined) {
      throw new Error(
        `Conflicting fields ${path}.${previous} and ${path}.${key} map to ${target} (wire key ${source}).`
      );
    }

    targets.set(target, key);
    sources.set(source, key);

    return { key, source, target, value };
  });
};

export let validateTypeProperties = (type: IntrospectedType, path: string): void => {
  if (type.type === 'object') {
    for (let { key, value } of getObjectProperties(type, path)) {
      validateTypeProperties(value, `${path}.${key}`);
    }
  }

  for (let [index, item] of (type.items ?? []).entries()) {
    validateTypeProperties(item, type.type === 'array' ? `${path}[]` : `${path}[${index}]`);
  }
};
