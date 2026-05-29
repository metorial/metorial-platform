import { ServiceError, badRequestError } from '@lowerdeck/error';
import { lookup } from 'node:dns/promises';
import { isValidCIDR, parse, parseCIDR } from 'ipaddr.js';

export type RuntimeNetworkRule = {
  action: 'allow';
  destination: string;
  portRangeStart?: number;
  portRangeEnd?: number;
};

let fullPortRange = { from: 1, to: 65535 };

let getPortForUrl = (url: URL) => {
  if (url.port) return Number(url.port);
  if (url.protocol === 'https:') return 443;
  if (url.protocol === 'http:') return 80;
  return null;
};

let isPortAllowed = (
  entry: PrismaJson.CompiledNetworkAllowEntry,
  port: number | null
) => {
  if (port === null) return false;

  let portRange = entry.portRange ?? fullPortRange;
  return port >= portRange.from && port <= portRange.to;
};

let isAddressAllowed = (address: string, cidr: string) => {
  if (!isValidCIDR(cidr)) return false;

  try {
    let parsedAddress = parse(address);
    let [range, prefix] = parseCIDR(cidr);

    if (parsedAddress.kind() !== range.kind()) return false;

    return parsedAddress.match(range, prefix);
  } catch {
    return false;
  }
};

export let egressPolicyToRuntimeNetworkRules = (
  egressPolicy: PrismaJson.CompiledEgressNetworkAllowList
): RuntimeNetworkRule[] =>
  egressPolicy.entries.map(entry => ({
    action: 'allow',
    destination: entry.cidr,
    portRangeStart: entry.portRange?.from,
    portRangeEnd:
      entry.portRange && entry.portRange.from !== entry.portRange.to
        ? entry.portRange.to
        : undefined
  }));

export let assertUrlAllowedByEgressPolicy = async (d: {
  url: string;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList | null;
}) => {
  if (!d.egressPolicy) return;

  let url = new URL(d.url);
  let port = getPortForUrl(url);
  let addresses = await lookup(url.hostname, { all: true });

  let isAllowed = addresses.every(({ address }) =>
    d.egressPolicy!.entries.some(
      entry => isPortAllowed(entry, port) && isAddressAllowed(address, entry.cidr)
    )
  );

  if (!isAllowed) {
    throw new ServiceError(
      badRequestError({
        message: `Remote URL is not allowed by the connection egress policy`
      })
    );
  }
};
