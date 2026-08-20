import { badRequestError, ServiceError } from '@lowerdeck/error';
import { computeSlateConfigSchemaV2Hash } from '@slates/proto';

export type SlateConfigPatch = {
  set?: Record<string, unknown>;
  remove?: string[];
};

export type SlateConfigFieldDescriptor = {
  visibility: 'plain' | 'secret';
  lifecycle: 'none' | 'projection' | 'reregister' | 'renew';
};

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let cloneAndDeepFreeze = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneAndDeepFreeze));
  }
  if (!isRecord(value)) return value;
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneAndDeepFreeze(nested)])
    )
  );
};

export let parseSlateConfigFieldDescriptors = (value: unknown) => {
  if (!isRecord(value)) throw new Error('Persisted config field descriptors are invalid');
  let result: Record<string, SlateConfigFieldDescriptor> = {};
  for (let [key, descriptor] of Object.entries(value)) {
    if (
      !isRecord(descriptor) ||
      !['plain', 'secret'].includes(String(descriptor.visibility)) ||
      !['none', 'projection', 'reregister', 'renew'].includes(String(descriptor.lifecycle)) ||
      Object.keys(descriptor).some(field => !['visibility', 'lifecycle'].includes(field))
    ) {
      throw new Error(`Persisted config descriptor ${key} is invalid`);
    }
    result[key] = descriptor as SlateConfigFieldDescriptor;
  }
  return result;
};

export let assertCanonicalStoredSlateConfigSchema = (schema: {
  version: number;
  descriptorHash: string | null;
  fields: unknown;
  schema: unknown;
}) => {
  if (schema.version !== 2 || !schema.descriptorHash || !isRecord(schema.schema)) {
    throw new Error('Canonical config schema v2 is required');
  }
  let fields = parseSlateConfigFieldDescriptors(schema.fields);
  let fieldOrder = Object.keys(fields).sort();
  let jsonSchema = cloneAndDeepFreeze(schema.schema) as Readonly<Record<string, unknown>>;
  let hash = computeSlateConfigSchemaV2Hash({
    version: 2,
    fieldOrder,
    fields,
    jsonSchema
  });
  if (hash !== schema.descriptorHash) {
    throw new Error('Persisted config descriptor hash is stale or fabricated');
  }
  return Object.freeze({
    version: 2 as const,
    hash,
    fieldOrder: Object.freeze(fieldOrder),
    fields: Object.freeze(
      Object.fromEntries(
        fieldOrder.map(key => [key, Object.freeze({ ...fields[key]! })])
      )
    ),
    jsonSchema
  });
};

export type CanonicalStoredSlateConfigSchema = ReturnType<
  typeof assertCanonicalStoredSlateConfigSchema
>;

export let redactWithCanonicalSlateConfigSchema = <Value>(
  value: Value,
  schema: CanonicalStoredSlateConfigSchema
): Value => {
  let secretKeys = new Set(
    Object.entries(schema.fields)
      .filter(([, descriptor]) => descriptor.visibility === 'secret')
      .map(([key]) => key)
  );
  let seen = new WeakMap<object, unknown>();
  let visit = (entry: unknown): unknown => {
    if (entry === null || typeof entry !== 'object') return entry;
    let existing = seen.get(entry);
    if (existing) return existing;
    if (Array.isArray(entry)) {
      let result: unknown[] = [];
      seen.set(entry, result);
      entry.forEach(nested => result.push(visit(nested)));
      return result;
    }
    let result: Record<string, unknown> = {};
    seen.set(entry, result);
    for (let [key, nested] of Object.entries(entry as Record<string, unknown>)) {
      result[key] = secretKeys.has(key) ? '[REDACTED]' : visit(nested);
    }
    return result;
  };
  return visit(value) as Value;
};

export let collectCanonicalSlateConfigSecretStrings = (
  value: unknown,
  schema: CanonicalStoredSlateConfigSchema
) => {
  let secretKeys = new Set(
    Object.entries(schema.fields)
      .filter(([, descriptor]) => descriptor.visibility === 'secret')
      .map(([key]) => key)
  );
  let secrets = new Set<string>();
  let seen = new WeakSet<object>();
  let collectStrings = (entry: unknown) => {
    if (typeof entry === 'string') {
      if (entry.length > 0) secrets.add(entry);
      return;
    }
    if (!entry || typeof entry !== 'object' || seen.has(entry)) return;
    seen.add(entry);
    for (let nested of Array.isArray(entry)
      ? entry
      : Object.values(entry as Record<string, unknown>)) {
      collectStrings(nested);
    }
  };
  let visit = (entry: unknown) => {
    if (!entry || typeof entry !== 'object') return;
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    for (let [key, nested] of Object.entries(entry as Record<string, unknown>)) {
      if (secretKeys.has(key)) collectStrings(nested);
      else visit(nested);
    }
  };
  visit(value);
  return [...secrets];
};

export let resolveStoredSlateConfigFieldDescriptors = (d: {
  schemaVersion: number;
  fields: unknown;
  value: unknown;
}) => {
  if (d.schemaVersion !== 1) return parseSlateConfigFieldDescriptors(d.fields);
  if (!isRecord(d.value)) return {};
  return Object.fromEntries(
    Object.keys(d.value).map(key => [
      key,
      { visibility: 'secret' as const, lifecycle: 'reregister' as const }
    ])
  );
};

export let validateSlateConfigPatch = (d: {
  patch: SlateConfigPatch;
  fields: Record<string, SlateConfigFieldDescriptor>;
  allowV1Loose?: boolean;
}) => {
  let set = d.patch.set ?? {};
  let remove = d.patch.remove ?? [];
  if (
    !isRecord(set) ||
    !Array.isArray(remove) ||
    remove.some(key => typeof key !== 'string')
  ) {
    throw new ServiceError(
      badRequestError({ code: 'invalid_config_patch', message: 'Invalid config patch.' })
    );
  }
  if (Object.keys(set).length === 0 && remove.length === 0) {
    throw new ServiceError(
      badRequestError({ code: 'empty_config_patch', message: 'Config patch is empty.' })
    );
  }
  if (new Set(remove).size !== remove.length) {
    throw new ServiceError(
      badRequestError({
        code: 'duplicate_config_remove',
        message: 'Config remove keys must be unique.'
      })
    );
  }
  let overlap = Object.keys(set).filter(key => remove.includes(key));
  if (overlap.length > 0) {
    throw new ServiceError(
      badRequestError({
        code: 'overlapping_config_patch',
        message: 'A config key cannot be set and removed together.'
      })
    );
  }
  let keys = [...Object.keys(set), ...remove];
  if (!d.allowV1Loose) {
    let unknown = keys.filter(key => !d.fields[key]);
    if (unknown.length > 0) {
      throw new ServiceError(
        badRequestError({
          code: 'unknown_config_key',
          message: `Unknown config keys: ${unknown.sort().join(', ')}`
        })
      );
    }
  }
  let fields = d.allowV1Loose
    ? Object.fromEntries(
        keys.map(key => [key, { visibility: 'secret', lifecycle: 'reregister' } as const])
      )
    : d.fields;
  return { set, remove, fields };
};

export let projectSlateConfigPresence = (d: {
  value: unknown;
  fields: Record<string, SlateConfigFieldDescriptor>;
}) => {
  if (!isRecord(d.value)) return {};
  let value = d.value;
  return Object.fromEntries(
    Object.entries(d.fields).flatMap(([key, descriptor]) => {
      if (!(key in value)) return [];
      return descriptor.visibility === 'secret'
        ? [[key, { configured: true }]]
        : [[key, value[key]]];
    })
  );
};

export let isConfigRecord = isRecord;

export let aggregateSlateConfigLifecycle = (d: {
  changedKeys: readonly string[];
  fields: Record<string, SlateConfigFieldDescriptor>;
}) => {
  let changed = [...new Set(d.changedKeys)].sort();
  let projectionKeys = changed.filter(key => d.fields[key]?.lifecycle === 'projection');
  let registrationIntent = changed.some(key => d.fields[key]?.lifecycle === 'reregister')
    ? ('reregister' as const)
    : changed.some(key => d.fields[key]?.lifecycle === 'renew')
      ? ('renew' as const)
      : null;
  return Object.freeze({
    changedKeys: Object.freeze(changed),
    projectionKeys: Object.freeze(projectionKeys),
    registrationIntent
  });
};
