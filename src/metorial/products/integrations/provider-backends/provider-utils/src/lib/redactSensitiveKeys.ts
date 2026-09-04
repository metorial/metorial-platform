let SENSITIVE_KEYS = new Set([
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'clientSecret',
  'client_secret',
  'code',
  'state',
  'authorization',
  'password',
  'secret'
]);

export let redactSensitiveKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactSensitiveKeys);

  if (value && typeof value === 'object') {
    let out: Record<string, unknown> = {};
    for (let [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : redactSensitiveKeys(nested);
    }
    return out;
  }

  return value;
};
