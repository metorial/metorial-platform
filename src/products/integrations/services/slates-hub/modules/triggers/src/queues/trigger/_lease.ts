export let webhookLeaseDates = (data: {
  expiresAt?: string | null;
  renewAfter?: string | null;
}) => {
  let parse = (value: string | null | undefined) => {
    if (value == null) return null;
    let date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid webhook lease date');
    return date;
  };
  let expiresAt = parse(data.expiresAt);
  let renewAfter = parse(data.renewAfter);
  let due = renewAfter ?? (expiresAt ? new Date(expiresAt.getTime() - 5 * 60_000) : null);

  return {
    expiresAt,
    renewAfter,
    nextAttemptAt: due ? new Date(Math.max(due.getTime(), Date.now() + 60_000)) : null
  };
};
