import { redactSensitiveKeys } from '../redactSensitiveKeys';

let MAX_PROVIDER_RESPONSE_LENGTH = 16 * 1024;

let truncateUtf8 = (value: string) => {
  let bytes = Buffer.from(value);
  if (bytes.length <= MAX_PROVIDER_RESPONSE_LENGTH) {
    return { value, truncated: false };
  }

  return {
    value: bytes
      .subarray(0, MAX_PROVIDER_RESPONSE_LENGTH)
      .toString('utf8')
      .replace(/\uFFFD$/, ''),
    truncated: true
  };
};

let asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

let getRetryAfterMs = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  let seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  let retryAt = new Date(String(value)).getTime();
  if (!Number.isFinite(retryAt)) return null;

  return Math.max(0, retryAt - Date.now());
};

export let getOAuthRegistrationErrorDetails = (error: unknown) => {
  let errorRecord = asRecord(error);
  let response = asRecord(errorRecord?.response);
  let responseData = response?.data;
  let responseRecord = asRecord(responseData);
  let headers = asRecord(response?.headers);
  let status = typeof response?.status === 'number' ? response.status : null;
  let oauthCode =
    typeof responseRecord?.error === 'string' ? responseRecord.error.slice(0, 100) : null;
  let description =
    typeof responseRecord?.error_description === 'string'
      ? responseRecord.error_description.slice(0, 4000)
      : null;
  let providerMessage =
    typeof responseRecord?.message === 'string'
      ? responseRecord.message.slice(0, 4000)
      : null;
  let safeResponse = responseData === undefined ? null : redactSensitiveKeys(responseData);
  let responseText: string;

  try {
    responseText = JSON.stringify(safeResponse);
  } catch {
    responseText = String(safeResponse);
  }

  let truncatedResponse = truncateUtf8(responseText);
  responseText = truncatedResponse.value;
  let responseTruncated = truncatedResponse.truncated;

  let retryAfterMs = getRetryAfterMs(headers?.['retry-after']);
  let isTransient =
    status === null || status === 408 || status === 425 || status === 429 || status >= 500;
  let diagnostics: string[] = [];
  if (status !== null) diagnostics.push(`HTTP ${status}`);
  if (oauthCode) diagnostics.push(`OAuth error ${oauthCode}`);

  return {
    status,
    oauthCode,
    message: providerMessage,
    description,
    response: responseTruncated ? responseText : safeResponse,
    responseText,
    responseTruncated,
    contentType:
      typeof headers?.['content-type'] === 'string' ? headers['content-type'] : null,
    retryAfterMs,
    isTransient,
    summary: diagnostics.length
      ? `OAuth client registration failed (${diagnostics.join(', ')})`
      : 'OAuth client registration failed because the provider could not be reached'
  };
};
