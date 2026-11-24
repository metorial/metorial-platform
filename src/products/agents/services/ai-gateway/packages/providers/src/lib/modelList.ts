import type { ConnectionCheckResult } from '@mtsrc/ai-gateway-spec';

let maxMessageLength = 500;

let modelListLength = (body: unknown) => {
  if (Array.isArray(body)) return body.length;
  if (!body || typeof body != 'object') return undefined;

  for (let key of ['data', 'models', 'result']) {
    let value = (body as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value.length;
  }

  return undefined;
};

let errorMessage = async (response: Response) => {
  let text = await response.text().catch(() => '');

  try {
    let body = JSON.parse(text);
    let message = body?.error?.message ?? body?.message ?? body?.error;
    if (typeof message == 'string') return message.slice(0, maxMessageLength);
  } catch {}

  return text.slice(0, maxMessageLength) || response.statusText;
};

// Listing models is free on every provider we support and needs the same credentials as
// inference, so a successful list proves the key works without spending tokens. Rate limits and
// server errors say nothing about the key, so they count as unreachable, not invalid.
export let checkModelList = async (d: {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  fetch: typeof fetch;
}): Promise<ConnectionCheckResult> => {
  let response: Response;

  try {
    response = await d.fetch(d.url, {
      method: 'GET',
      headers: { accept: 'application/json', ...d.headers },
      signal: d.signal
    });
  } catch (error) {
    return {
      outcome: 'unreachable',
      message: error instanceof Error ? error.message : 'The provider could not be reached.'
    };
  }

  if (response.ok) {
    let body = await response.json().catch(() => undefined);

    return {
      outcome: 'valid',
      httpStatus: response.status,
      modelCount: modelListLength(body)
    };
  }

  let message = await errorMessage(response);

  if (response.status == 429 || response.status >= 500) {
    return { outcome: 'unreachable', httpStatus: response.status, message };
  }

  return { outcome: 'invalid', httpStatus: response.status, message };
};
