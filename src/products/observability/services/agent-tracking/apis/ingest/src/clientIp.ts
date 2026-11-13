import { isIP } from 'node:net';

let ipv6PrefixGroups = 4;

let stripDecorations = (raw: string) => {
  let value = raw.trim();

  let bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) return bracketed[1]!;

  let withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
  if (withPort) return withPort[1]!;

  return value;
};

let expandIpv6 = (address: string): number[] | null => {
  let value = address.toLowerCase().split('%')[0]!;

  let tail: number[] = [];
  let embedded = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);

  if (embedded) {
    let octets = embedded[1]!.split('.').map(Number);
    tail = [(octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!];
    value = value.slice(0, -embedded[1]!.length) + '0:0';
  }

  let [head, rest] = value.split('::');
  let left = head ? head.split(':') : [];
  let right = rest ? rest.split(':') : [];
  let missing = 8 - left.length - right.length;

  if (value.includes('::') ? missing < 1 : missing != 0) return null;

  let groups = [...left, ...Array(value.includes('::') ? missing : 0).fill('0'), ...right].map(
    group => parseInt(group, 16)
  );
  if (groups.length != 8 || groups.some(group => !Number.isInteger(group))) return null;

  if (tail.length) groups.splice(6, 2, ...tail);

  return groups;
};

// Hosts rotate IPv6 addresses within their /64, so a device is keyed by that prefix.
export let normalizeClientIp = (raw: string | null | undefined) => {
  if (!raw) return undefined;

  let value = stripDecorations(raw);
  let family = isIP(value.split('%')[0]!);

  if (family == 4) return value;
  if (family != 6) return undefined;

  let groups = expandIpv6(value);
  if (!groups) return undefined;

  let isMappedIpv4 = groups.slice(0, 5).every(group => group == 0) && groups[5] == 0xffff;
  if (isMappedIpv4) {
    return [groups[6]! >> 8, groups[6]! & 255, groups[7]! >> 8, groups[7]! & 255].join('.');
  }

  let prefix = groups
    .slice(0, ipv6PrefixGroups)
    .map(group => group.toString(16))
    .join(':');

  return `${prefix}::/64`;
};

export let forwardedChain = (header: string | null | undefined) =>
  (header ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

// Each trusted proxy appends the address of the peer it accepted, so the client is the entry
// `trustedHops` positions from the right; anything further left is client-controlled.
export let clientIpOf = (d: {
  forwardedFor: string | null | undefined;
  remoteAddress?: string;
  trustedHops: number;
}) => {
  let fallback = normalizeClientIp(d.remoteAddress);
  if (d.trustedHops <= 0) return fallback;

  let chain = forwardedChain(d.forwardedFor);
  let index = chain.length - d.trustedHops;
  if (index < 0) return fallback;

  return normalizeClientIp(chain[index]) ?? fallback;
};
