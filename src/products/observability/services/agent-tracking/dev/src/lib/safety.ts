export class UsageError extends Error {}

let loopbackHosts = new Set(['localhost', '::1', '0:0:0:0:0:0:0:1']);

let stripPort = (host: string) => {
  let bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(host);
  if (bracketed) return bracketed[1]!;

  return (host.split(':').length == 2 ? host.split(':')[0]! : host).replace(/\.$/, '');
};

export let targetHosts = (target: string): string[] => {
  let match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(target.trim());
  if (!match) return [];

  let authority = match[1]!;
  let hostList = authority.slice(authority.lastIndexOf('@') + 1);

  return hostList
    .split(',')
    .map(host => stripPort(host.trim()).toLowerCase())
    .filter(Boolean);
};

let isLoopback = (host: string) =>
  loopbackHosts.has(host) || host.endsWith('.localhost') || /^127(\.\d{1,3}){3}$/.test(host);

let matchesExtra = (host: string, extra: string) => {
  let pattern = extra.trim().toLowerCase();

  return pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host == pattern;
};

let isAllowedHost = (host: string, extraHosts: string[] = []) =>
  isLoopback(host) || extraHosts.some(extra => matchesExtra(host, extra));

// An allowlist, not a guess at what production looks like: loopback and the hosts named for
// this run. Anything else, including IP addresses and AWS endpoints, needs the
// explicit override.
export let looksLikeProduction = (target: string, extraHosts: string[] = []) => {
  let hosts = targetHosts(target);

  return hosts.length == 0 || hosts.some(host => !isAllowedHost(host, extraHosts));
};

export let assertNotProduction = (
  target: string,
  allowProduction: boolean,
  label: string,
  extraHosts: string[] = []
) => {
  if (allowProduction || !looksLikeProduction(target, extraHosts)) return;

  let refused = targetHosts(target).filter(host => !isAllowedHost(host, extraHosts));

  throw new UsageError(
    `The ${label} host${refused.length > 1 ? 's' : ''} ${refused.join(', ') || '(unparsable)'} ${refused.length > 1 ? 'are' : 'is'} not on the allowlist (localhost, --allow-host). Pass --allow-host <host> for this run, or --allow-production.`
  );
};

export let readSecretFromEnv = (
  variable: string | undefined,
  label: string,
  env: NodeJS.ProcessEnv = process.env
) => {
  if (!variable) throw new UsageError(`--${label}-env is required (the name of an env var).`);

  let value = env[variable];
  if (!value)
    throw new UsageError(`The env var ${variable} named by --${label}-env is empty.`);

  return value;
};

export let redact = (text: string, secrets: string[]) =>
  secrets.reduce(
    (result, secret) => (secret ? result.split(secret).join('[redacted]') : result),
    text
  );

export let redactUrl = (target: string) => {
  try {
    let url = new URL(target);
    if (url.password) url.password = 'redacted';
    if (url.username) url.username = 'redacted';

    return url.toString();
  } catch {
    return target.replace(/\/\/[^@/]*@/, '//[redacted]@');
  }
};
