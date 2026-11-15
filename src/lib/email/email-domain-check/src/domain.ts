export let normalizeDomain = (domain: string) =>
  domain
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');

export let getEmailDomain = (email: string) => {
  let trimmed = email.trim().toLowerCase();
  let atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return undefined;

  return normalizeDomain(trimmed.slice(atIndex + 1));
};

export let getDomainWithParents = (domain: string) => {
  let labels = normalizeDomain(domain).split('.').filter(Boolean);
  let candidates: string[] = [];

  for (let i = 0; i < labels.length - 1; i++) {
    candidates.push(labels.slice(i).join('.'));
  }

  return candidates;
};

export let matchesDomainSuffix = (domain: string, suffixes: string[]) => {
  let normalized = normalizeDomain(domain);
  if (!normalized) return false;

  return suffixes.some(suffix => {
    let normalizedSuffix = normalizeDomain(suffix);
    if (!normalizedSuffix) return false;

    return normalized === normalizedSuffix || normalized.endsWith(`.${normalizedSuffix}`);
  });
};
