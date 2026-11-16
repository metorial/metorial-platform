export let redactedValue = '[redacted]';

let sensitiveFieldPattern =
  /secret|token|password|passwd|passphrase|passcode|authorization|cookie|credential|signature|assertion|(api|private|signing|access|encryption|master|session|license)key/;

let sensitiveFieldNames = new Set(['key', 'pwd', 'otp', 'codeverifier']);

let sensitiveContainerNames = new Set([
  'env',
  'environment',
  'headers',
  'config',
  'configuration'
]);

let sensitiveContainerFieldNames = new Set(['envvars', 'keyinput']);

let sensitiveValuePatterns = [
  /^(bearer|basic)\s+[\w+/.~=-]{8,}$/i,
  /^eyJ[\w-]+\.[\w-]+\.[\w-]*$/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i
];

let getFieldWords = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

let isIdentifierField = (words: string[]) => {
  let last = words[words.length - 1];
  return last == 'id' || last == 'ids';
};

export let isSensitiveField = (key: string) => {
  let words = getFieldWords(key);
  if (isIdentifierField(words)) return false;

  let name = words.join('');
  return sensitiveFieldNames.has(name) || sensitiveFieldPattern.test(name);
};

let isSensitiveContainerField = (key: string) => {
  let words = getFieldWords(key);
  if (isIdentifierField(words)) return false;

  return (
    sensitiveContainerNames.has(words[words.length - 1] ?? '') ||
    sensitiveContainerFieldNames.has(words.join(''))
  );
};

let isSensitiveValue = (value: string) =>
  sensitiveValuePatterns.some(pattern => pattern.test(value));

let isBinary = (value: object) => ArrayBuffer.isView(value) || value instanceof ArrayBuffer;

let isObject = (value: unknown): value is object => !!value && typeof value == 'object';

type RedactionMode = 'fields' | 'identifiers_only' | 'all';

export let redactSensitiveFields = (
  value: unknown,
  opts: { isSensitive?: (key: string) => boolean } = {}
): any => {
  let isSensitive = opts.isSensitive ?? isSensitiveField;
  let seen = new WeakSet<object>();

  let visit = (current: unknown, mode: RedactionMode): unknown => {
    if (typeof current == 'string') {
      return mode != 'fields' || isSensitiveValue(current) ? redactedValue : current;
    }

    if (!isObject(current) || current instanceof Date) return current;
    if (isBinary(current)) return redactedValue;

    if (seen.has(current)) return '[circular]';
    seen.add(current);

    if (Array.isArray(current)) return current.map(item => visit(item, mode));

    return Object.fromEntries(
      Object.entries(current).map(([key, item]) => {
        if (mode == 'all' || isSensitiveContainerField(key)) return [key, visit(item, 'all')];
        if (isSensitive(key)) return [key, visit(item, 'identifiers_only')];

        let isKeptIdentifier =
          mode == 'identifiers_only' &&
          typeof item == 'string' &&
          isIdentifierField(getFieldWords(key));

        return [key, isKeptIdentifier ? item : visit(item, mode)];
      })
    );
  };

  return visit(value, 'fields');
};

export let redactSensitiveUrl = (
  input: string,
  opts: { isSensitive?: (key: string) => boolean } = {}
) => {
  let isSensitive = opts.isSensitive ?? isSensitiveField;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input.split('?')[0]!;
  }

  if (url.username) url.username = redactedValue;
  if (url.password) url.password = redactedValue;

  for (let key of Array.from(new Set(url.searchParams.keys()))) {
    if (isSensitive(key)) url.searchParams.set(key, redactedValue);
  }

  return url.toString();
};
