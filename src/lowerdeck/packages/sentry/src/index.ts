import * as SentryBase from '@sentry/core';

let sentryRef = { current: SentryBase };

let ignoredSentryHttpErrorCodes = new Set([
  'bad_request',
  'forbidden',
  'invalid_data',
  'not_found',
  'unauthorized'
]);

let lowerdeckErrorPrefix = '[@lowerdeck/error]:';

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

let toStatusCode = (value: unknown): number | null => {
  let parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

let toErrorCode = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

let getMessagePayload = (message: string): Record<string, unknown> | null => {
  let start = message.indexOf('{');
  let end = message.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    let payload = JSON.parse(message.slice(start, end + 1));
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
};

let isLowerdeckErrorValue = (value: unknown): boolean => {
  let visited = new Set<unknown>();

  let visit = (current: unknown): boolean => {
    if (typeof current === 'string') {
      return current.includes(lowerdeckErrorPrefix);
    }

    if (!isRecord(current)) return false;
    if (visited.has(current)) return false;
    visited.add(current);

    if (current.object === 'ServiceError' || current.object === 'ErrorRecord') return true;

    for (let candidate of [
      current.originalException,
      current.response,
      current.data,
      current.cause,
      current.error,
      current.message
    ]) {
      if (visit(candidate)) return true;
    }

    return false;
  };

  return visit(value);
};

export let getSentryHttpErrorDetails = (
  value: unknown
): { status: number | null; code: string | null } | null => {
  let visited = new Set<unknown>();

  let visit = (current: unknown): { status: number | null; code: string | null } | null => {
    if (typeof current === 'string') {
      let payload = getMessagePayload(current);
      if (payload) return visit(payload);

      let code = current.match(
        /\b(unauthorized|forbidden|not_found|bad_request|invalid_data)\b/i
      )?.[1];
      if (code) return { status: null, code: code.toLowerCase() };

      return null;
    }

    if (!isRecord(current)) return null;
    if (visited.has(current)) return null;
    visited.add(current);

    let status =
      toStatusCode(current.status) ??
      toStatusCode(current.statusCode) ??
      toStatusCode(current.httpStatus);
    let code = toErrorCode(current.code)?.toLowerCase() ?? null;

    for (let candidate of [
      current.originalException,
      current.response,
      current.data,
      current.cause,
      current.error,
      current.message
    ]) {
      let nested = visit(candidate);
      if (!nested) continue;

      status ??= nested.status;
      code ??= nested.code;

      if (status !== null && code) break;
    }

    return status !== null || code ? { status, code } : null;
  };

  return visit(value);
};

export let setSentry = (sentry: typeof SentryBase) => {
  sentryRef.current = sentry;
};

export let getSentry = (): typeof SentryBase => sentryRef.current;

export let shouldIgnoreSentryHttpError = (value: unknown): boolean => {
  if (!isLowerdeckErrorValue(value)) return false;

  let details = getSentryHttpErrorDetails(value);
  if (!details) return false;

  if (details.status !== null && details.status >= 400 && details.status < 500) {
    return true;
  }

  return details.code ? ignoredSentryHttpErrorCodes.has(details.code) : false;
};
