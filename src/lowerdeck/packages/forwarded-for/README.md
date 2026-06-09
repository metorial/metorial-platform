# `@lowerdeck/forwarded-for`

Extract client IP addresses from various HTTP headers. Handles X-Forwarded-For, X-Real-IP, CF-Connecting-IP, and custom Metorial headers.

## Installation

```bash
npm install @lowerdeck/forwarded-for
yarn add @lowerdeck/forwarded-for
bun add @lowerdeck/forwarded-for
pnpm add @lowerdeck/forwarded-for
```

## Usage

```typescript
import { extractIp, parseForwardedFor } from '@lowerdeck/forwarded-for';

// Extract IP from headers (checks multiple sources)
const ip = extractIp(request.headers);
console.log(ip); // '192.168.1.1'

// Parse X-Forwarded-For header
const ips = parseForwardedFor(request.headers.get('x-forwarded-for'));
console.log(ips); // ['192.168.1.1', '10.0.0.1']

// Checked headers in order:
// 1. metorial-connecting-ip
// 2. cf-connecting-ip (Cloudflare)
// 3. x-forwarded-for (first IP)
// 4. x-real-ip

// Works with plain objects or Headers API
extractIp({
  'x-forwarded-for': '192.168.1.1, 10.0.0.1',
  'x-real-ip': '192.168.1.1'
});

extractIp(new Headers({
  'x-forwarded-for': '192.168.1.1'
}));
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
