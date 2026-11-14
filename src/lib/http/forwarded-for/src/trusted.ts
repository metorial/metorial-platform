import { findMatchingCidr, normalizeIp } from '@lowerdeck/ip-range';

export let CLOUDFLARE_IP_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32'
];

export let PRIVATE_IP_RANGES = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10'
];

type HeaderSource = { get(name: string): string | null };

// Each proxy appends the address of the peer that connected to it. Walking from the right,
// internal hops (our VPC and load balancer) are skipped; the next entry is the peer that
// reached our load balancer. Cloudflare is trusted only in that position: anyone can egress
// from Cloudflare ranges (e.g. WARP), so Cloudflare addresses further left prove nothing.
// When the peer is a Cloudflare edge, the client is the cf-connecting-ip Cloudflare sets
// (it overwrites any client-supplied value), or else the entry Cloudflare appended before
// its own address.
export let extractTrustedClientIp = (
  headers: HeaderSource,
  opts: { trustedProxyRanges?: string[] } = {}
) => {
  let internalProxyRanges = opts.trustedProxyRanges ?? PRIVATE_IP_RANGES;

  let chain = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
  if (!chain.length) return undefined;

  for (let i = chain.length - 1; i >= 0; i--) {
    let ip = normalizeIp(chain[i]!);
    if (!ip) return undefined;
    if (findMatchingCidr(ip, internalProxyRanges)) continue;
    if (!findMatchingCidr(ip, CLOUDFLARE_IP_RANGES)) return ip;

    let cloudflareClientIp = normalizeIp(headers.get('cf-connecting-ip') ?? '');
    if (cloudflareClientIp) return cloudflareClientIp;

    return i > 0 ? normalizeIp(chain[i - 1]!) : ip;
  }

  return normalizeIp(chain[0]!);
};
