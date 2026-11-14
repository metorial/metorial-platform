import { isServiceError } from '@lowerdeck/error';

export type OAuthRequestErrorDetails = {
  status: number | null;
  oauthCode: string | null;
  isTransient: boolean;
  retryAfterMs: number | null;
};

let asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

let getStatus = (error: unknown) => {
  let record = asRecord(error);
  let response = asRecord(record?.response);
  let status = response?.status ?? record?.status ?? record?.statusCode;

  if (isServiceError(error)) status = error.data.status;

  return typeof status === 'number' && Number.isInteger(status) ? status : null;
};

let getOAuthCode = (error: unknown) => {
  let record = asRecord(error);
  let response = asRecord(record?.response);
  let data = asRecord(response?.data);
  let code = data?.error;

  return typeof code === 'string' && /^[a-z0-9._-]{1,100}$/i.test(code) ? code : null;
};

let getRetryAfterMs = (error: unknown) => {
  let record = asRecord(error);
  let response = asRecord(record?.response);
  let headers = asRecord(response?.headers);
  let retryAfter = headers?.['retry-after'];

  if (typeof retryAfter !== 'string' && typeof retryAfter !== 'number') return null;

  let seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(seconds * 1000, 5000));

  let retryAt = new Date(String(retryAfter)).getTime();
  if (!Number.isFinite(retryAt)) return null;

  return Math.max(0, Math.min(retryAt - Date.now(), 5000));
};

export let isTransientOAuthStatus = (status: number | null) =>
  status === null || status === 408 || status === 425 || status === 429 || status >= 500;

export let getOAuthRequestErrorDetails = (error: unknown): OAuthRequestErrorDetails => {
  let status = getStatus(error);

  return {
    status,
    oauthCode: getOAuthCode(error),
    isTransient: isTransientOAuthStatus(status),
    retryAfterMs: getRetryAfterMs(error)
  };
};

export let formatOAuthRequestError = (
  message: string,
  details: Pick<OAuthRequestErrorDetails, 'status' | 'oauthCode'>
) => {
  let diagnostics: string[] = [];
  if (details.status !== null) diagnostics.push(`HTTP ${details.status}`);
  if (details.oauthCode) diagnostics.push(`OAuth error ${details.oauthCode}`);

  if (!diagnostics.length) return `${message} because the OAuth provider could not be reached`;
  return `${message} (${diagnostics.join(', ')})`;
};
