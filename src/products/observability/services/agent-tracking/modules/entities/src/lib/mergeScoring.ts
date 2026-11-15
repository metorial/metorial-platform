export let minimumSuggestionScore = 0.3;

export type MergeReason =
  | 'shared_client_identity'
  | 'email_local_part'
  | 'email_local_part_prefix'
  | 'display_name'
  | 'email_matches_name';

export type ScoredUser = {
  id: string;
  name: string | null;
  emails: string[];
  clientIdentityIds: string[];
};

let reasonScores: Record<MergeReason, number> = {
  shared_client_identity: 0.6,
  email_local_part: 0.5,
  display_name: 0.4,
  email_local_part_prefix: 0.3,
  email_matches_name: 0.3
};

export let normalizeDisplayName = (name: string | null | undefined) => {
  if (!name) return null;

  let normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return normalized.split(' ').length >= 2 ? normalized : null;
};

export let splitEmail = (email: string) => {
  let at = email.lastIndexOf('@');
  if (at <= 0) return null;

  let local = email.slice(0, at).toLowerCase().split('+')[0]!;
  let tokens = local.split(/[._-]+/).filter(Boolean);

  return {
    domain: email.slice(at + 1).toLowerCase(),
    local: tokens.join(''),
    tokens
  };
};

let domainsCompatible = (a: string, b: string, allowedDomains: string[]) =>
  a == b || (allowedDomains.includes(a) && allowedDomains.includes(b));

let isTokenPrefix = (short: string[], long: string[]) =>
  short.length > 0 &&
  short.length < long.length &&
  short.every((token, i) => long[i] == token);

export let candidateKeys = (user: ScoredUser) => {
  let keys = new Set<string>();

  for (let email of user.emails) {
    let parts = splitEmail(email);
    if (!parts?.local) continue;

    keys.add(`local:${parts.local}`);
    keys.add(`local:${parts.tokens[0]}`);
    keys.add(`name:${parts.tokens.join(' ')}`);
  }

  let name = normalizeDisplayName(user.name);
  if (name) {
    keys.add(`name:${name}`);
    keys.add(`local:${name.replace(/ /g, '')}`);
    keys.add(`local:${name.split(' ')[0]}`);
  }

  for (let id of user.clientIdentityIds) keys.add(`client:${id}`);

  return [...keys];
};

export let scoreMergeCandidate = (d: {
  discovered: ScoredUser;
  managed: ScoredUser;
  allowedEmailDomains?: string[];
}) => {
  let allowedDomains = (d.allowedEmailDomains ?? []).map(domain => domain.toLowerCase());
  let reasons = new Set<MergeReason>();

  let managedClients = new Set(d.managed.clientIdentityIds);
  if (d.discovered.clientIdentityIds.some(id => managedClients.has(id))) {
    reasons.add('shared_client_identity');
  }

  for (let discoveredEmail of d.discovered.emails) {
    let discovered = splitEmail(discoveredEmail);
    if (!discovered?.local) continue;

    for (let managedEmail of d.managed.emails) {
      let managed = splitEmail(managedEmail);
      if (!managed?.local) continue;
      if (!domainsCompatible(discovered.domain, managed.domain, allowedDomains)) continue;

      if (discovered.local == managed.local) reasons.add('email_local_part');
      else if (
        isTokenPrefix(discovered.tokens, managed.tokens) ||
        isTokenPrefix(managed.tokens, discovered.tokens)
      ) {
        reasons.add('email_local_part_prefix');
      }
    }
  }

  let discoveredName = normalizeDisplayName(d.discovered.name);
  let managedName = normalizeDisplayName(d.managed.name);
  if (discoveredName && discoveredName == managedName) reasons.add('display_name');

  let nameFromEmail = (emails: string[]) =>
    emails.map(email => splitEmail(email)?.tokens.join(' ')).filter(Boolean) as string[];

  if (
    (managedName && nameFromEmail(d.discovered.emails).includes(managedName)) ||
    (discoveredName && nameFromEmail(d.managed.emails).includes(discoveredName))
  ) {
    reasons.add('email_matches_name');
  }

  if (!reasons.size) return null;

  let remaining = 1;
  for (let reason of reasons) remaining *= 1 - reasonScores[reason];

  let score = Math.round((1 - remaining) * 1000) / 1000;
  if (score < minimumSuggestionScore) return null;

  return { score, reasons: [...reasons].sort() };
};
