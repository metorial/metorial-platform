import ipaddr from 'ipaddr.js';

export type AddressFamily = 'ipv4' | 'ipv6';

export type IpRange = {
  family: AddressFamily;
  start: bigint;
  end: bigint;
};

let IPV4_UNIVERSE = '0.0.0.0/0';
let IPV6_UNIVERSE = '::/0';

let ipv4ToBigInt = (octets: number[]) =>
  BigInt(octets[0]! * 2 ** 24 + octets[1]! * 2 ** 16 + octets[2]! * 2 ** 8 + octets[3]!);

let bigIntToIpv4 = (value: bigint) => {
  let n = Number(value);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255] as [
    number,
    number,
    number,
    number
  ];
};

let bytesToBigInt = (bytes: number[]) =>
  bytes.reduce((acc, byte) => (acc << BigInt(8)) + BigInt(byte), BigInt(0));

let bigIntToBytes = (value: bigint, length: number) => {
  let bytes = new Array<number>(length).fill(0);
  let current = value;

  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(current & BigInt(0xff));
    current >>= BigInt(8);
  }

  return bytes;
};

export let parseCidrOrThrow = (cidr: string): IpRange => {
  if (!ipaddr.isValidCIDR(cidr)) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }

  let [addr, prefix] = ipaddr.parseCIDR(cidr);

  if (addr.kind() === 'ipv4') {
    let start = ipv4ToBigInt((addr as ipaddr.IPv4).octets);
    let size = BigInt(2) ** BigInt(32 - prefix);
    return {
      family: 'ipv4',
      start,
      end: start + size - BigInt(1)
    };
  }

  let start = bytesToBigInt((addr as ipaddr.IPv6).toByteArray());
  let size = BigInt(2) ** BigInt(128 - prefix);
  return {
    family: 'ipv6',
    start,
    end: start + size - BigInt(1)
  };
};

let cidrToRange = (cidr: string) => parseCidrOrThrow(cidr);

let rangeToCidr = (range: IpRange): string => {
  if (range.start > range.end) {
    throw new Error('Invalid IP range');
  }

  let bits = range.family === 'ipv4' ? 32 : 128;
  let blockSize = range.end - range.start + BigInt(1);

  if (blockSize <= BigInt(0) || (blockSize & (blockSize - BigInt(1))) !== BigInt(0)) {
    throw new Error('Range is not a valid CIDR block');
  }

  if (range.start % blockSize !== BigInt(0)) {
    throw new Error('Range is not CIDR aligned');
  }

  let prefix = bits - Number(log2(blockSize));

  if (range.family === 'ipv4') {
    return `${ipaddr.fromByteArray(bigIntToIpv4(range.start)).toString()}/${prefix}`;
  }

  return `${ipaddr.fromByteArray(bigIntToBytes(range.start, 16)).toString()}/${prefix}`;
};

let log2 = (value: bigint) => {
  let count = 0;
  let current = value;

  while (current > BigInt(1)) {
    if (current % BigInt(2) !== BigInt(0)) {
      throw new Error('Invalid power of two');
    }
    current /= BigInt(2);
    count += 1;
  }

  return count;
};

let rangesToCidrs = (ranges: IpRange[]) => ranges.flatMap(range => rangeToMinimalCidrs(range));

let rangeToMinimalCidrs = (range: IpRange): string[] => {
  let cidrs: string[] = [];
  let bits = range.family === 'ipv4' ? 32 : 128;
  let current = range.start;

  while (current <= range.end) {
    let maxSize = range.end - current + BigInt(1);
    let stretch = BigInt(0);

    while (stretch < BigInt(bits)) {
      let nextStretch = stretch + BigInt(1);
      if (current % BigInt(2) ** nextStretch !== BigInt(0)) break;
      stretch = nextStretch;
    }

    while (BigInt(2) ** stretch > maxSize) {
      stretch -= BigInt(1);
    }

    let blockSize = BigInt(2) ** stretch;
    cidrs.push(
      rangeToCidr({
        family: range.family,
        start: current,
        end: current + blockSize - BigInt(1)
      })
    );
    current += blockSize;
  }

  return cidrs;
};

let normalizeRanges = (ranges: IpRange[]) => {
  if (ranges.length === 0) return [];

  let sorted = [...ranges].sort((a, b) =>
    a.family === b.family
      ? a.start === b.start
        ? a.end < b.end
          ? -1
          : 1
        : a.start < b.start
          ? -1
          : 1
      : a.family === 'ipv4'
        ? -1
        : 1
  );

  let merged: IpRange[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    let current = sorted[i]!;
    let last = merged[merged.length - 1]!;

    if (current.family !== last.family) {
      merged.push(current);
      continue;
    }

    if (current.start <= last.end + BigInt(1)) {
      last.end = current.end > last.end ? current.end : last.end;
      continue;
    }

    merged.push(current);
  }

  return merged;
};

let subtractRange = (base: IpRange, remove: IpRange): IpRange[] => {
  if (base.family !== remove.family) return [base];
  if (remove.end < base.start || remove.start > base.end) return [base];

  let result: IpRange[] = [];

  if (base.start < remove.start) {
    result.push({ family: base.family, start: base.start, end: remove.start - BigInt(1) });
  }

  if (base.end > remove.end) {
    result.push({ family: base.family, start: remove.end + BigInt(1), end: base.end });
  }

  return result;
};

let intersectRange = (a: IpRange, b: IpRange): IpRange | null => {
  if (a.family !== b.family) return null;

  let start = a.start > b.start ? a.start : b.start;
  let end = a.end < b.end ? a.end : b.end;

  if (start > end) return null;
  return { family: a.family, start, end };
};

let cidrsToRanges = (cidrs: string[]) => normalizeRanges(cidrs.map(cidrToRange));

export let cidrSetUnion = (cidrs: string[]) =>
  rangesToCidrs(normalizeRanges(cidrsToRanges(cidrs)));

export let cidrSetSubtract = (base: string[], remove: string[]) => {
  let result = cidrsToRanges(base);

  for (let removeRange of cidrsToRanges(remove)) {
    result = result.flatMap(range => subtractRange(range, removeRange));
  }

  return rangesToCidrs(normalizeRanges(result));
};

export let cidrSetIntersect = (a: string[], b: string[]) => {
  let result: IpRange[] = [];

  for (let left of cidrsToRanges(a)) {
    for (let right of cidrsToRanges(b)) {
      let overlap = intersectRange(left, right);
      if (overlap) result.push(overlap);
    }
  }

  return rangesToCidrs(normalizeRanges(result));
};

export let cidrSetIsEmpty = (cidrs: string[]) => cidrs.length === 0;

export let cidrSetEqualsUniverse = (cidrs: string[], family: AddressFamily) => {
  let universe = family === 'ipv4' ? IPV4_UNIVERSE : IPV6_UNIVERSE;
  let normalized = cidrSetUnion(cidrs);
  return normalized.length === 1 && normalized[0] === universe;
};

export let cidrSetNormalize = (cidrs: string[]) => cidrSetUnion(cidrs);

export let getAddressFamily = (cidr: string): AddressFamily => parseCidrOrThrow(cidr).family;

export let splitCidrsByFamily = (cidrs: string[]) => ({
  ipv4: cidrs.filter(cidr => getAddressFamily(cidr) === 'ipv4'),
  ipv6: cidrs.filter(cidr => getAddressFamily(cidr) === 'ipv6')
});

export let universeCidr = (family: AddressFamily) =>
  family === 'ipv4' ? IPV4_UNIVERSE : IPV6_UNIVERSE;

export let emptyCidr = (family: AddressFamily) =>
  family === 'ipv4' ? '0.0.0.0/32' : '::/128';
