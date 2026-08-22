let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export let expiredRegistrationSecretReference = (
  value: unknown,
  name: string,
  nowMs = Date.now(),
  depth = 0
): boolean => {
  if (depth > 8) return false;
  if (Array.isArray(value)) {
    return value
      .slice(0, 1000)
      .some(entry => expiredRegistrationSecretReference(entry, name, nowMs, depth + 1));
  }
  if (!isRecord(value)) return false;
  let expiryValue =
    value.retiringClientStateSecretName === name
      ? value.retiringValidUntil
      : value.clientStateSecretName === name
        ? value.validUntil
        : undefined;
  if (typeof expiryValue === 'string') {
    let expiresAt = Date.parse(expiryValue);
    if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return true;
  }
  return Object.values(value)
    .slice(0, 1000)
    .some(entry => expiredRegistrationSecretReference(entry, name, nowMs, depth + 1));
};
