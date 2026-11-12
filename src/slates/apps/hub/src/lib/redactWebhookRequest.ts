let credentialHeaders = ['authorization', 'proxy-authorization'];

let REDACTED = '[REDACTED]';

// Receive URLs carry a registration's secret key; only a tenant's own registration keeps its URL.
let redactUrl = (url: string, registration: { owner: string; urlKey: string }) => {
  let origin = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(url)?.[0] ?? '';
  let urlKey = /^\/receive\/([^/?#]+)/.exec(url.slice(origin.length))?.[1];
  if (registration.owner === 'tenant' && urlKey === registration.urlKey) return url;

  return `${origin}/receive/${REDACTED}`;
};

// A shared-delivery bearer token is valid for every tenant on the binding, so it never leaves
// the hub. Without a registration (operators only) the URL is kept.
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
