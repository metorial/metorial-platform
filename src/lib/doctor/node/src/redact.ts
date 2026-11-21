import type { JsonValue } from './types';

let maxDepth = 8;
let maxStringLength = 2048;
let redacted = '***';
let truncatedValue = '[truncated]';
let truncatedSuffix = '…[truncated]';

let secretKeyParts = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'credential',
  'authorization',
  'cookie',
  'signature'
];

let secretKeyNames = new Set(['pwd', 'pass', 'auth']);

let pemPattern = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END [A-Z0-9 ]+-----/g;
let urlPasswordPattern = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^\s:/?#@]*):([^\s/?#@]*)@/g;
let queryPattern =
  /([?&;](?:password|passwd|pwd|secret|token|access_token|refresh_token|id_token|api_key|apikey|key|sig|signature|credential|auth|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&\s#"']*/gi;
let bearerPattern = /\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

export let isSecretKey = (key: string) => {
  let normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  return (
    secretKeyNames.has(normalized) || secretKeyParts.some(part => normalized.includes(part))
  );
};

export let redactString = (value: string) => {
  let result = value
    .replace(pemPattern, (_, label: string) => `[redacted ${label}]`)
    .replace(
      urlPasswordPattern,
      (_, scheme: string, user: string) => `${scheme}${user}:${redacted}@`
    )
    .replace(queryPattern, (_, prefix: string) => `${prefix}${redacted}`)
    .replace(bearerPattern, (_, word: string) => `${word} ${redacted}`);

  let codePoints = Array.from(result);
  if (codePoints.length <= maxStringLength) return result;

  return codePoints.slice(0, maxStringLength).join('') + truncatedSuffix;
};

let redactValue = (value: unknown, depth: number): JsonValue => {
  if (typeof value == 'string') return redactString(value);
  if (typeof value == 'number') return Number.isFinite(value) ? value : null;
  if (typeof value == 'boolean' || value === null) return value;
  if (typeof value == 'bigint') return value.toString();

  if (Array.isArray(value)) {
    if (depth >= maxDepth) return truncatedValue;
    return value.map(item => redactValue(item, depth + 1));
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value == 'object') {
    if (depth >= maxDepth) return truncatedValue;

    let result: { [key: string]: JsonValue } = {};
    for (let [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined || typeof item == 'function') continue;
      result[key] =
        isSecretKey(key) && item !== null ? redacted : redactValue(item, depth + 1);
    }

    return result;
  }

  return null;
};

export let redact = (value: unknown): JsonValue => redactValue(value, 0);
