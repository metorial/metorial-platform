import type { ExtraValue } from '@metorial/groundstation-spec';

export let maxExtraKeys = 32;
export let maxExtraValueBytes = 256;

let maxExtraKeyLength = 64;

let keyPattern = /^[a-z0-9][a-z0-9_.-]*$/;

let contentKeyParts = [
  'prompt',
  'content',
  'text',
  'message',
  'body',
  'input',
  'output',
  'param',
  'arg',
  'command',
  'cmd',
  'path',
  'file',
  'dir',
  'url',
  'uri',
  'query',
  'diff',
  'patch',
  'response',
  'result',
  'error',
  'reason',
  'summary',
  'description',
  'title',
  'email',
  'token',
  'secret',
  'password',
  'key',
  'cookie',
  'authorization',
  'instruction',
  'thought'
];

export let isContentKey = (key: string) => {
  let lower = key.toLowerCase();

  return contentKeyParts.some(part => lower.includes(part));
};

export let normalizeExtraKey = (key: string) => {
  let lower = key.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

  if (lower.length > maxExtraKeyLength) lower = lower.slice(0, maxExtraKeyLength);

  return keyPattern.test(lower) ? lower : null;
};

let clampString = (value: string) => {
  if (Buffer.byteLength(value) <= maxExtraValueBytes) return value;

  let clamped = value.slice(0, maxExtraValueBytes);

  while (Buffer.byteLength(clamped) > maxExtraValueBytes) clamped = clamped.slice(0, -1);

  let last = clamped.charCodeAt(clamped.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) clamped = clamped.slice(0, -1);

  return clamped;
};

export let sanitizeExtraValue = (value: unknown): ExtraValue | null => {
  if (typeof value == 'string') return clampString(value);
  if (typeof value == 'boolean') return value;
  if (typeof value == 'number') return Number.isFinite(value) ? value : null;

  if (value !== null && typeof value == 'object') {
    try {
      let json = JSON.stringify(value);
      return json === undefined ? null : clampString(json);
    } catch {
      return null;
    }
  }

  return null;
};

export type SanitizedExtras = {
  extras: Record<string, ExtraValue>;
  dropped: string[];
};

export let sanitizeExtras = (
  client: string,
  raw: Record<string, unknown> | undefined
): SanitizedExtras => {
  let extras: Record<string, ExtraValue> = {};
  let dropped: string[] = [];

  if (!raw) return { extras, dropped };

  let count = 0;

  for (let [rawKey, rawValue] of Object.entries(raw)) {
    let key = normalizeExtraKey(rawKey);

    if (!key || isContentKey(key)) {
      dropped.push(`extras.${key && !isContentKey(key) ? key : 'content_key'}`);
      continue;
    }

    let value = sanitizeExtraValue(rawValue);

    if (value === null) {
      dropped.push(`extras.${key}`);
      continue;
    }

    if (count >= maxExtraKeys) {
      dropped.push('extras.overflow');
      break;
    }

    extras[`x.${client}.${key}`] = value;
    count++;
  }

  return { extras, dropped };
};
