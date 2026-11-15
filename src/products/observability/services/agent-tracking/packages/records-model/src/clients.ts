let clientPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export let normalizeClient = (raw: string): string | null => {
  let slug = raw.trim().toLowerCase().replace(/_/g, '-');

  return clientPattern.test(slug) ? slug : null;
};
