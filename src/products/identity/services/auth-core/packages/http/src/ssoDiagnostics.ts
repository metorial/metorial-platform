let sensitiveFields = new Set([
  'accesstoken',
  'apikey',
  'apisecret',
  'assertion',
  'authorization',
  'authorizationcode',
  'bearertoken',
  'clientsecret',
  'codeverifier',
  'cookie',
  'deviceclientsecret',
  'idtoken',
  'newpassword',
  'oldpassword',
  'password',
  'privatekey',
  'refreshtoken',
  'relaystate',
  'samlassertion',
  'samlresponse',
  'secret',
  'setcookie',
  'token'
]);

let scimErrorDetails: Record<number, string> = {
  400: 'Invalid SCIM request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'SCIM resource not found',
  405: 'SCIM method not allowed',
  409: 'SCIM resource already exists or conflicts',
  413: 'SCIM request body is too large',
  429: 'Too many SCIM requests'
};

export let scimErrorBody = (status: number) => ({
  schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
  detail: scimErrorDetails[status] ?? 'SCIM request failed',
  status: String(status)
});

export let redactScimQuery = <T extends Record<string, unknown>>(query: T) => ({
  ...query,
  ...(query.filter === undefined ? {} : { filter: '[Redacted]' })
});

let isSensitiveField = (name: string) =>
  sensitiveFields.has(name.replace(/[-_]/g, '').toLowerCase());

export let redactSsoPayload = (value: unknown, depth = 0): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 20) return '[Truncated]';
  if (Array.isArray(value)) return value.map(item => redactSsoPayload(item, depth + 1));

  let record = value as Record<string, unknown>;
  let patchField =
    typeof record.path === 'string' ? record.path.split(/[.:]/).at(-1) : undefined;
  let sensitivePatch = patchField && isSensitiveField(patchField);

  return Object.fromEntries(
    Object.entries(record).map(([name, entry]) => [
      name,
      isSensitiveField(name) || (sensitivePatch && name.toLowerCase() === 'value')
        ? '[Redacted]'
        : redactSsoPayload(entry, depth + 1)
    ])
  );
};
