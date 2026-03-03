export let narrowSessionIdFilter = (d: {
  allowedSessionIds?: string[];
  requestedSessionIds?: string[];
}) => {
  if (!d.allowedSessionIds) return d.requestedSessionIds;

  if (!d.requestedSessionIds || d.requestedSessionIds.length == 0) {
    return d.allowedSessionIds;
  }

  let allowed = new Set(d.allowedSessionIds);
  return d.requestedSessionIds.filter(sessionId => allowed.has(sessionId));
};
