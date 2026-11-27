let sensitiveHeaderNames = ['authorization', 'proxy-authorization', 'cookie'];
let sensitiveHeaderParts = ['token', 'secret', 'signature', 'key', 'auth'];

export let redactHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => {
      let lower = name.toLowerCase();
      let isSensitive =
        sensitiveHeaderNames.includes(lower) ||
        sensitiveHeaderParts.some(part => lower.includes(part));

      return [name, isSensitive ? '[REDACTED]' : value];
    })
  );
