import type { EgressGrantPolicy } from './runtimeTokens';

type Cidr = { family: 4 | 6; network: bigint; prefix: number; text: string };

let denyAllEntries = [{ cidr: '0.0.0.0/32' }, { cidr: '::/128' }];

let parseIPv4 = (address: string) => {
  let parts = address.split('.');
  if (parts.length !== 4) return undefined;

  let value = 0n;
  for (let part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return undefined;
    value = (value << 8n) | BigInt(part);
  }

  return value;
};

let parseIPv6 = (address: string) => {
  let embedded: bigint | undefined;
  let lastColon = address.lastIndexOf(':');
  if (address.includes('.', lastColon)) {
    embedded = parseIPv4(address.slice(lastColon + 1));
    if (embedded === undefined) return undefined;
    address = `${address.slice(0, lastColon + 1)}0:0`;
  }

  let halves = address.split('::');
  if (halves.length > 2) return undefined;

  let head = halves[0] ? halves[0].split(':') : [];
  let tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return undefined;

  let groups = [
    ...head,
    ...Array<string>(halves.length === 2 ? missing : 0).fill('0'),
    ...tail
  ];
  if (groups.length !== 8) return undefined;

  let value = 0n;
  for (let group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return undefined;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }

  if (embedded !== undefined) value = (value & ~0xffffffffn) | embedded;
  return value;
};

let parseCidr = (text: string): Cidr | undefined => {
  let [address, prefixText] = text.split('/');
  if (!address) return undefined;

  let family: 4 | 6 = address.includes(':') ? 6 : 4;
  let bits = family === 4 ? 32 : 128;
  let network = family === 4 ? parseIPv4(address) : parseIPv6(address);
  let prefix = prefixText === undefined ? bits : Number(prefixText);
  if (network === undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > bits) {
    return undefined;
  }

  return { family, network, prefix, text };
};

let maskFor = (cidr: Cidr, prefix: number) => {
  let bits = BigInt(cidr.family === 4 ? 32 : 128);
  return ((1n << bits) - 1n) ^ ((1n << (bits - BigInt(prefix))) - 1n);
};

let intersectCidrs = (a: Cidr, b: Cidr) => {
  if (a.family !== b.family) return undefined;

  let [wide, narrow] = a.prefix <= b.prefix ? [a, b] : [b, a];
  let mask = maskFor(wide, wide.prefix);
  return (narrow.network & mask) === (wide.network & mask) ? narrow : undefined;
};

let intersectPortRanges = (
  a: PrismaJson.PortRange | undefined,
  b: PrismaJson.PortRange | undefined
): { portRange?: PrismaJson.PortRange } | undefined => {
  if (!a && !b) return {};
  if (!a || !b) return { portRange: a ?? b };

  let from = Math.max(a.from, b.from);
  let to = Math.min(a.to, b.to);
  return from <= to ? { portRange: { from, to } } : undefined;
};

export let intersectEgressAllowLists = (
  a: PrismaJson.CompiledEgressNetworkAllowList | undefined,
  b: PrismaJson.CompiledEgressNetworkAllowList | undefined
): PrismaJson.CompiledEgressNetworkAllowList | undefined => {
  if (!a || !b) return a ?? b;

  let entries = new Map<string, PrismaJson.CompiledNetworkAllowEntry>();

  for (let left of a.entries) {
    let leftCidr = parseCidr(left.cidr);
    if (!leftCidr) continue;

    for (let right of b.entries) {
      let rightCidr = parseCidr(right.cidr);
      let cidr = rightCidr && intersectCidrs(leftCidr, rightCidr);
      let ports = cidr && intersectPortRanges(left.portRange, right.portRange);
      if (!cidr || !ports) continue;

      let entry = { cidr: cidr.text, ...ports };
      entries.set(JSON.stringify(entry), entry);
    }
  }

  return {
    direction: 'egress',
    entries: entries.size ? [...entries.values()] : denyAllEntries
  };
};

export let resolveGrantEgress = (d: {
  configuration: PrismaJson.FunctionConfiguration;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
  allowAll?: boolean;
}): { policy?: EgressGrantPolicy; allowAll?: true } => {
  if (d.allowAll || d.configuration.disableNetworkIsolation) return { allowAll: true };

  let effective = intersectEgressAllowLists(d.configuration.egress, d.egressPolicy);
  return effective ? { policy: { entries: effective.entries } } : {};
};
