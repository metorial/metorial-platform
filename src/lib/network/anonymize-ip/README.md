# `@lowerdeck/anonymize-ip`

Mask IP addresses for privacy compliance (GDPR, CCPA). Supports both IPv4 and IPv6 with configurable masking levels.

## Installation

```bash
npm install @lowerdeck/anonymize-ip
yarn add @lowerdeck/anonymize-ip
bun add @lowerdeck/anonymize-ip
pnpm add @lowerdeck/anonymize-ip
```

## Usage

```typescript
import { anonymizeIP } from '@lowerdeck/anonymize-ip';

// Default anonymization (keeps 2 groups)
anonymizeIP('192.168.1.1');
// '192.168.x.x'

// Custom keep groups (IPv4: 1-3, IPv6: 1-7)
anonymizeIP('192.168.1.1', { keepGroups: 3 });
// '192.168.1.x'

anonymizeIP('192.168.1.1', { keepGroups: 1 });
// '192.x.x.x'

// Custom mask character
anonymizeIP('192.168.1.1', { maskChar: '0' });
// '192.168.0.0'

// IPv6 support
anonymizeIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
// '2001:0db8:x:x:x:x:x:x'

anonymizeIP('2001:0db8:85a3::8a2e:0370:7334', { keepGroups: 3 });
// '2001:0db8:85a3:x:x:x:x:x'
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
