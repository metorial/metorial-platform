let credentialHeaders = ['authorization', 'proxy-authorization'];

let REDACTED = '[REDACTED]';

// The URL a request arrived on names a registration by its secret key. A request received
// on, or handed on from, a registration other tenants share must not reveal that key, so
// only a tenant's own registration keeps its URL.
let redactUrl = (url: string, registration: { owner: string; urlKey: string }) => {
  let origin = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(url)?.[0] ?? '';
  let urlKey = /^\/receive\/([^/?#]+)/.exec(url.slice(origin.length))?.[1];
  if (registration.owner === 'tenant' && urlKey === registration.urlKey) return url;

  return `${origin}/receive/${REDACTED}`;
};

// A push through shared delivery infrastructure carries a bearer token that is valid for
// every tenant on that binding, so it must never leave the hub. Without a registration the
// URL is kept, which is for operators only.
export let redactWebhookRequest = (
  request: PrismaJson.SlateWebhookEventRequest | null,
  registration?: { owner: string; urlKey: string }
) =>
  request && {
    ...request,
    url: registration ? redactUrl(request.url, registration) : request.url,
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([name, value]) => [
        name,
        credentialHeaders.includes(name.toLowerCase()) ? REDACTED : value
      ])
    )
  };
