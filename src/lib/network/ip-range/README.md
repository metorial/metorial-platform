# `@lowerdeck/ip-range`

IP address and CIDR utilities: normalization, matching, rate-limit keys, and set operations (union, subtract, intersect) over IPv4 and IPv6 CIDR blocks.

## Installation

```bash
npm install @lowerdeck/ip-range
yarn add @lowerdeck/ip-range
bun add @lowerdeck/ip-range
pnpm add @lowerdeck/ip-range
```

## Usage

```typescript
import {
  cidrSetSubtract,
  findMatchingCidr,
  ipRateLimitKey,
  isIpInCidr,
  normalizeCidr,
  normalizeIp
} from '@lowerdeck/ip-range';

normalizeIp('::ffff:1.2.3.4');
// => '1.2.3.4'

normalizeCidr('10.1.2.3/8');
// => '10.0.0.0/8'

isIpInCidr('10.0.5.1', '10.0.0.0/16');
// => true

findMatchingCidr('192.168.1.10', ['10.0.0.0/8', '192.168.0.0/16']);
// => '192.168.0.0/16'

// IPv6 clients are keyed by their /64 network
ipRateLimitKey('2001:db8:1:2:3:4:5:6');
// => '2001:db8:1:2::/64'

cidrSetSubtract(['10.0.0.0/8'], ['10.0.0.0/9']);
// => ['10.128.0.0/9']
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
