import ipaddr from 'ipaddr.js';
import { parseCidrOrThrow, type IpRange } from './cidrSet';

let parseAddress = (ip: string) => {
  let trimmed = ip.trim();
  if (!ipaddr.isValid(trimmed)) return undefined;

  let address = ipaddr.parse(trimmed);
  if (address.kind() === 'ipv6' && (address as ipaddr.IPv6).isIPv4MappedAddress()) {
    return (address as ipaddr.IPv6).toIPv4Address();
  }

  return address;
};

let toSingleAddressCidr = (ip: string) => {
  let address = parseAddress(ip);
  if (!address) return undefined;

  return `${address.toString()}/${address.kind() === 'ipv4' ? 32 : 128}`;
};

let rangeContains = (range: IpRange, inner: IpRange) =>
  range.family === inner.family && range.start <= inner.start && range.end >= inner.end;

export let isValidIp = (ip: string) => parseAddress(ip) !== undefined;

export let normalizeIp = (ip: string) => parseAddress(ip)?.toString();

export let isValidCidr = (cidr: string) => {
  try {
    parseCidrOrThrow(cidr.trim());
    return true;
  } catch {
    return false;
  }
};

export let normalizeCidr = (cidr: string) => {
  let trimmed = cidr.trim();
  if (!ipaddr.isValidCIDR(trimmed)) return undefined;

  let [address, prefix] = ipaddr.parseCIDR(trimmed);
  let network =
    address.kind() === 'ipv4'
      ? ipaddr.IPv4.networkAddressFromCIDR(trimmed)
      : ipaddr.IPv6.networkAddressFromCIDR(trimmed);

  return `${network.toString()}/${prefix}`;
};

let parseNetworkRange = (cidr: string) => {
  let normalized = normalizeCidr(cidr);
  return normalized ? parseCidrOrThrow(normalized) : undefined;
};

export let isIpInCidr = (ip: string, cidr: string) => {
  let single = toSingleAddressCidr(ip);
  let network = parseNetworkRange(cidr);
  if (!single || !network) return false;

  return rangeContains(network, parseCidrOrThrow(single));
};

export let findMatchingCidr = <T extends string>(ip: string, cidrs: T[]) => {
  let single = toSingleAddressCidr(ip);
  if (!single) return undefined;

  let target = parseCidrOrThrow(single);

  return cidrs.find(cidr => {
    let network = parseNetworkRange(cidr);
    return !!network && rangeContains(network, target);
  });
};

export let ipRateLimitKey = (ip: string, opts: { ipv6PrefixLength?: number } = {}) => {
  let address = parseAddress(ip);
  if (!address) return undefined;
  if (address.kind() === 'ipv4') return address.toString();

  let prefix = opts.ipv6PrefixLength ?? 64;
  return normalizeCidr(`${address.toString()}/${prefix}`);
};
