import { isIP } from 'net';
import type { EgressPolicy } from './egressGrant';

let DEFAULT_HOSTS = [
  'registry.npmjs.org:443',
  'archive.ubuntu.com:80',
  'archive.ubuntu.com:443',
  '*.archive.ubuntu.com:80',
  '*.archive.ubuntu.com:443',
  'security.ubuntu.com:80',
  'security.ubuntu.com:443',
  'ports.ubuntu.com:80',
  'ports.ubuntu.com:443',
  'deb.debian.org:80',
  'deb.debian.org:443',
  'security.debian.org:80',
  'security.debian.org:443'
];

let HOST_LABEL = /^[a-z0-9_-]{1,63}$/;

export let defaultBuildEgressHosts = (npmRegistryUrl?: string) => {
  if (!npmRegistryUrl) return DEFAULT_HOSTS;

  let url = new URL(npmRegistryUrl);
  let port = url.port || (url.protocol === 'http:' ? '80' : '443');

  return [...DEFAULT_HOSTS, `${url.hostname}:${port}`];
};

let parsePort = (raw: string, item: string) => {
  let port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`Invalid port in build egress rule "${item}"`);
  }
  return port;
};

let parseHost = (item: string) => {
  let [rawPattern, rawPort, ...rest] = item.trim().split(':');
  let pattern = rawPattern!.toLowerCase().replace(/\.$/, '');
  let name = pattern.startsWith('*.') ? pattern.slice(2) : pattern;

  if (
    rest.length ||
    pattern.length > 253 ||
    !name.split('.').every(label => HOST_LABEL.test(label))
  ) {
    throw new Error(`Invalid build egress host "${item}"`);
  }

  return { pattern, port: rawPort === undefined ? undefined : parsePort(rawPort, item) };
};

let parseCidr = (item: string): EgressPolicy['entries'][number] => {
  let trimmed = item.trim();
  let slash = trimmed.indexOf('/');
  let address = slash === -1 ? trimmed : trimmed.slice(0, slash);
  let [bits, ports, ...rest] = slash === -1 ? [] : trimmed.slice(slash + 1).split(':');
  let family = isIP(address);
  let maxBits = family === 6 ? 128 : 32;

  if (
    !family ||
    rest.length ||
    (bits !== undefined && (!/^\d+$/.test(bits) || Number(bits) > maxBits))
  ) {
    throw new Error(`Invalid build egress CIDR "${item}"`);
  }

  let cidr = bits === undefined ? address : `${address}/${bits}`;
  if (ports === undefined) return { cidr };

  let [from, to = from] = ports.split('-');
  let portRange = { from: parsePort(from!, item), to: parsePort(to!, item) };
  if (portRange.from > portRange.to) throw new Error(`Invalid port range in "${item}"`);

  return { cidr, portRange };
};

export let parseBuildEgressPolicy = (d: {
  hosts: string[];
  cidrs: string[];
}): EgressPolicy => {
  let hosts = new Map<string, { anyPort: boolean; ports: number[] }>();

  for (let item of d.hosts) {
    let { pattern, port } = parseHost(item);
    let host = hosts.get(pattern) ?? { anyPort: false, ports: [] };

    if (port === undefined) host.anyPort = true;
    else if (!host.ports.includes(port)) host.ports.push(port);

    hosts.set(pattern, host);
  }

  let policy: EgressPolicy = { entries: d.cidrs.map(parseCidr) };

  if (hosts.size) {
    policy.hosts = [...hosts.entries()].map(([pattern, host]) =>
      host.anyPort ? { pattern } : { pattern, ports: host.ports }
    );
  }

  return policy;
};
