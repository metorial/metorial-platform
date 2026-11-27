export const shuttleUnreachableErrorPattern =
  /Unable to reach server .*metorial-shuttle/i;

const ignoredStatusCodes = new Set([401, 404]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStatusCode(record: Record<string, unknown>): number | null {
  return toStatusCode(record.status) ?? toStatusCode(record.statusCode);
}

export function toStatusCode(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function shouldIgnoreSentryHttpError(hint: unknown): boolean {
  if (!isRecord(hint) || !isRecord(hint.originalException)) {
    return false;
  }

  const originalException = hint.originalException;
  const response = isRecord(originalException.response)
    ? originalException.response
    : null;

  const statusCode =
    (response ? getStatusCode(response) : null) ?? getStatusCode(originalException);

  return statusCode !== null && ignoredStatusCodes.has(statusCode);
}
