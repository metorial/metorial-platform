import type { SessionContextRepo } from '@mtsrc/agent-tracking-spec';

let maxRemoteLength = 512;
let maxSegmentLength = 128;

let providerHosts: Record<string, string> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
  azure: 'dev.azure.com',
  azure_devops: 'dev.azure.com',
  codeberg: 'codeberg.org'
};

let hostAliases: Record<string, string> = {
  'ssh.github.com': 'github.com',
  'www.github.com': 'github.com',
  'ssh.dev.azure.com': 'dev.azure.com',
  'altssh.bitbucket.org': 'bitbucket.org'
};

let hostPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
let segmentPattern = /^[a-z0-9_.~-]+$/;

let splitRemote = (raw: string): { host: string; path: string } | null => {
  if (!raw.includes('://')) {
    let scp = /^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/.exec(raw);
    if (scp) return { host: scp[1]!, path: scp[2]! };

    let bare = /^([^/\s]+)\/(.+)$/.exec(raw);
    return bare && bare[1]!.includes('.') ? { host: bare[1]!, path: bare[2]! } : null;
  }

  try {
    let url = new URL(raw);
    if (!url.hostname) return null;

    return { host: url.hostname, path: url.pathname };
  } catch {
    return null;
  }
};

let cleanSegments = (path: string, host: string) => {
  let segments = path
    .replace(/\.git\/?$/i, '')
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean);

  if (host == 'dev.azure.com') {
    if (segments[0] == 'v3') segments.shift();
    segments = segments.filter(segment => segment != '_git');
  }

  return segments;
};

export let normalizeHost = (raw: string) => {
  let host = raw.trim().toLowerCase().replace(/\.$/, '');
  host = hostAliases[host] ?? host;

  if (host.endsWith('.visualstudio.com')) host = 'dev.azure.com';

  return hostPattern.test(host) ? host : null;
};

export let repoIdentifier = (repo: Pick<SessionContextRepo, 'provider' | 'owner' | 'name'>) =>
  `${repo.provider}/${repo.owner}/${repo.name}`;

let buildRepo = (host: string, segments: string[]): SessionContextRepo | null => {
  if (segments.length < 2) return null;
  if (segments.some(segment => segment.length > maxSegmentLength)) return null;
  if (!segments.every(segment => segmentPattern.test(segment))) return null;

  let name = segments[segments.length - 1]!;
  let owner = segments.slice(0, -1).join('/');

  return { provider: host, owner, name, url: `https://${host}/${owner}/${name}` };
};

export let parseRemote = (raw: string | undefined): SessionContextRepo | null => {
  let trimmed = raw?.trim();
  if (!trimmed || trimmed.length > maxRemoteLength) return null;

  let parts = splitRemote(trimmed);
  if (!parts) return null;

  let host = normalizeHost(parts.host);
  if (!host) return null;

  return buildRepo(host, cleanSegments(parts.path, host));
};

export let repoFromParts = (d: {
  provider?: string;
  owner?: string;
  name?: string;
}): SessionContextRepo | null => {
  if (!d.provider || !d.owner || !d.name) return null;

  let provider = d.provider.trim().toLowerCase();
  let host = normalizeHost(providerHosts[provider] ?? provider);
  if (!host) return null;

  return buildRepo(host, cleanSegments(`${d.owner}/${d.name}`, host));
};
