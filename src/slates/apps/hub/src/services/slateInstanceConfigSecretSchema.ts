import { Prisma } from '../../prisma/generated/client';
import { isRecord } from './slateTriggerSecretBinding';

let INSTANCE_CONFIG_SECRET_MARKER_TYPE = 'metorial.instance_config_secret/v1';
export let instanceConfigSecretMarker = (key: string) => ({
  type: INSTANCE_CONFIG_SECRET_MARKER_TYPE,
  key,
  present: true as const
});
export let isInstanceConfigSecretMarker = (
  value: unknown
): value is ReturnType<typeof instanceConfigSecretMarker> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>).type === INSTANCE_CONFIG_SECRET_MARKER_TYPE &&
  (value as Record<string, unknown>).present === true &&
  typeof (value as Record<string, unknown>).key === 'string' &&
  Object.keys(value).every(key => ['type', 'key', 'present'].includes(key));

export type ConfigPath = (string | number)[];
let isSecretSchema = (schema: Record<string, unknown>) =>
  schema.writeOnly === true ||
  schema.sensitive === true ||
  schema['x-secret'] === true ||
  schema['x-metorial-secret'] === true ||
  ['password', 'secret'].includes(String(schema.format));
let encodeConfigPathPart = (part: string | number) =>
  String(part).split('~').join('~0').split('/').join('~1');
export let configPathKey = (path: ConfigPath) => path.map(encodeConfigPathPart).join('/');
let decodeConfigPath = (key: string) => {
  if (!key || key.startsWith('/') || key.endsWith('/')) {
    throw new Error('Instance config secret path is invalid');
  }
  return key.split('/').map(part => {
    let decoded = part.split('~1').join('/').split('~0').join('~');
    if (encodeConfigPathPart(decoded) !== part) {
      throw new Error('Instance config secret path is not canonical');
    }
    return decoded;
  });
};
export let collectInstanceConfigSecretPaths = (
  schema: unknown,
  value: unknown,
  path: ConfigPath = [],
  result = new Map<string, ConfigPath>()
) => {
  if (!isRecord(schema)) return result;
  if (isSecretSchema(schema)) {
    if (value !== undefined) result.set(configPathKey(path), path);
    return result;
  }
  if (isRecord(value)) {
    let properties = isRecord(schema.properties) ? schema.properties : {};
    let declared = new Set(Object.keys(properties));
    for (let [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        collectInstanceConfigSecretPaths(childSchema, value[key], [...path, key], result);
      }
    }
    if (isRecord(schema.additionalProperties)) {
      for (let [key, childValue] of Object.entries(value)) {
        if (!declared.has(key)) {
          collectInstanceConfigSecretPaths(
            schema.additionalProperties,
            childValue,
            [...path, key],
            result
          );
        }
      }
    }
  }
  if (Array.isArray(value) && isRecord(schema.items)) {
    value.forEach((child, index) =>
      collectInstanceConfigSecretPaths(schema.items, child, [...path, index], result)
    );
  }
  for (let unionKey of ['allOf', 'anyOf', 'oneOf'] as const) {
    let branches = schema[unionKey];
    if (Array.isArray(branches)) {
      branches.forEach(branch =>
        collectInstanceConfigSecretPaths(branch, value, path, result)
      );
    }
  }
  return result;
};
export let resolveDeclaredInstanceConfigSecretPath = (d: { schema: unknown; key: string }) => {
  let parts = decodeConfigPath(d.key);
  let resolve = (schema: unknown, index: number, path: ConfigPath): ConfigPath[] => {
    if (!isRecord(schema)) return [];
    let unionMatches = (['allOf', 'anyOf', 'oneOf'] as const).flatMap(unionKey => {
      let branches = schema[unionKey];
      return Array.isArray(branches)
        ? branches.flatMap(branch => resolve(branch, index, path))
        : [];
    });
    if (index === parts.length) {
      return [...(isSecretSchema(schema) ? [path] : []), ...unionMatches];
    }
    let part = parts[index]!;
    let matches = [...unionMatches];
    let properties = isRecord(schema.properties) ? schema.properties : {};
    if (part in properties) {
      matches.push(...resolve(properties[part], index + 1, [...path, part]));
    } else if (isRecord(schema.additionalProperties)) {
      matches.push(...resolve(schema.additionalProperties, index + 1, [...path, part]));
    }
    if (isRecord(schema.items) && /^(0|[1-9][0-9]*)$/.test(part)) {
      matches.push(...resolve(schema.items, index + 1, [...path, Number(part)]));
    }
    return matches;
  };
  let matches = resolve(d.schema, 0, []).filter(path => configPathKey(path) === d.key);
  if (matches.length === 0) {
    throw new Error('Instance config path is not a declared secret field');
  }
  let first = matches[0]!;
  if (matches.some(path => JSON.stringify(path) !== JSON.stringify(first))) {
    throw new Error('Instance config secret path is ambiguous');
  }
  return first;
};
export let getConfigPathValue = (value: unknown, path: ConfigPath) =>
  path.reduce<unknown>((current, part) => {
    if (Array.isArray(current) && typeof part === 'number') return current[part];
    if (isRecord(current) && typeof part === 'string') return current[part];
    return undefined;
  }, value);
export let setConfigPathValue = (value: unknown, path: ConfigPath, next: unknown) => {
  let current = value;
  for (let index = 0; index < path.length - 1; index += 1) {
    let part = path[index]!;
    if (Array.isArray(current) && typeof part === 'number') current = current[part];
    else if (isRecord(current) && typeof part === 'string') current = current[part];
    else throw new Error('Instance config secret path is invalid');
  }
  let last = path.at(-1);
  if (Array.isArray(current) && typeof last === 'number') current[last] = next;
  else if (isRecord(current) && typeof last === 'string') current[last] = next;
  else throw new Error('Instance config secret path is invalid');
};
export let cloneConfigValue = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

export let extractInstanceConfigSecretEntries = (d: {
  schema: unknown;
  value: Record<string, unknown>;
}) => {
  let result: { key: string; path: ConfigPath; plaintext: string }[] = [];
  for (let [key, path] of collectInstanceConfigSecretPaths(d.schema, d.value)) {
    let value = getConfigPathValue(d.value, path);
    if (isInstanceConfigSecretMarker(value)) {
      if (value.key !== key) throw new Error('Instance config secret marker binding mismatch');
      continue;
    }
    if (typeof value !== 'string') {
      throw new Error(`Secret config field ${key} must be a string`);
    }
    result.push({ key, path, plaintext: value });
  }
  return result;
};

export let prepareDeclaredInstanceConfigSecretImport = (d: {
  schema: unknown;
  value: unknown;
  key: string;
  plaintext: string;
  markerCutover: boolean;
}) => {
  if (!isRecord(d.value)) throw new Error('Instance config value must be an object');
  let path = resolveDeclaredInstanceConfigSecretPath({ schema: d.schema, key: d.key });
  let currentValue = getConfigPathValue(d.value, path);
  if (currentValue === undefined) {
    throw new Error('Declared instance config secret path is absent from the config value');
  }
  if (typeof currentValue !== 'string' && !isInstanceConfigSecretMarker(currentValue)) {
    throw new Error('Declared instance config secret value must be a string');
  }
  if (isInstanceConfigSecretMarker(currentValue) && currentValue.key !== d.key) {
    throw new Error('Instance config secret marker binding mismatch');
  }
  let value = cloneConfigValue(d.value) as Record<string, Prisma.JsonValue>;
  let marker = instanceConfigSecretMarker(d.key);
  setConfigPathValue(value, path, d.markerCutover ? marker : d.plaintext);
  return { key: configPathKey(path), path, value, marker };
};
