export let normalizeConsumerEmail = (email: string) => email.trim().toLowerCase();

export let normalizeConsumerEmails = (emails?: string[]) => {
  let normalizedEmails = (emails ?? []).map(normalizeConsumerEmail).filter(Boolean);

  if (!normalizedEmails.length) return undefined;

  return Array.from(new Set(normalizedEmails));
};

/**
 * Rows written before emails were normalized can still hold mixed case, so identity lookups
 * have to match case-insensitively instead of comparing against the normalized value.
 */
export let consumerEmailEquals = (email: string) => ({
  equals: normalizeConsumerEmail(email),
  mode: 'insensitive' as const
});
