import {
  ingestTagKeyPattern,
  maxIngestTags,
  maxIngestTagValueLength,
  type ContextTagOrigin,
  type SessionContextTag
} from '@mtsrc/agent-tracking-spec';

let tagNamespace = 'metorial.';
let envPrefix = 'METORIAL_';

let maxTagKeyLength = 64;

let reservedTagKeys = new Set([
  'metorial.user.ref',
  'metorial.device.ref',
  'metorial.agent.ref'
]);

let sensitiveEnvPattern = /(TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL)/;

let cleanValue = (value: unknown) => {
  if (typeof value != 'string' && typeof value != 'number' && typeof value != 'boolean') {
    return undefined;
  }

  let text = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();

  return text && text.length <= maxIngestTagValueLength ? text : undefined;
};

export let normalizeTagKey = (raw: string) => {
  let key = raw.trim().toLowerCase();
  if (!key.includes('.')) key = tagNamespace + key;

  if (key.length > maxTagKeyLength || !ingestTagKeyPattern.test(key)) return undefined;
  if (reservedTagKeys.has(key)) return undefined;

  return key;
};

export let envTagKey = (name: string) => {
  if (!name.startsWith(envPrefix) || sensitiveEnvPattern.test(name)) return undefined;

  return normalizeTagKey(tagNamespace + name.slice(envPrefix.length).toLowerCase());
};

export let buildTag = (
  rawKey: string,
  rawValue: unknown,
  origin: ContextTagOrigin
): SessionContextTag | undefined => {
  let k = normalizeTagKey(rawKey);
  let v = cleanValue(rawValue);

  return k && v ? { k, v, origin } : undefined;
};

export let dedupeTags = (tags: (SessionContextTag | undefined)[]) => {
  let byKey = new Map<string, SessionContextTag>();

  for (let tag of tags) {
    if (!tag || byKey.has(`${tag.origin}\u0000${tag.k}`)) continue;
    if (byKey.size >= maxIngestTags) break;

    byKey.set(`${tag.origin}\u0000${tag.k}`, tag);
  }

  return [...byKey.values()];
};

export let namespacedTags = (attributes: Record<string, unknown>, origin: ContextTagOrigin) =>
  Object.entries(attributes)
    .filter(([key]) => key.startsWith(tagNamespace))
    .map(([key, value]) => buildTag(key, value, origin));

export let envTags = (env: Record<string, unknown>) =>
  Object.entries(env).map(([name, value]) => {
    let key = envTagKey(name);
    return key ? buildTag(key, value, 'environment') : undefined;
  });

export let configTags = (config: {
  tags?: unknown;
  tracked?: unknown;
  modified?: unknown;
}) => {
  if (!config.tags || typeof config.tags != 'object' || Array.isArray(config.tags)) return [];

  let origin: ContextTagOrigin =
    config.tracked === true && config.modified === false ? 'repo' : 'environment';

  return Object.entries(config.tags as Record<string, unknown>).map(([key, value]) =>
    buildTag(key, value, origin)
  );
};

export let sourceTags = (tags: { key: string; value: string }[]) =>
  dedupeTags(tags.map(tag => buildTag(tag.key, tag.value, 'source')));
