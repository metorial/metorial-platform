# `@lowerdeck/canonicalize`

Canonicalize JSON according to RFC 8785 standard for deterministic serialization. Ensures consistent JSON representation regardless of key order, essential for signing and hashing.

## Installation

```bash
npm install @lowerdeck/canonicalize
yarn add @lowerdeck/canonicalize
bun add @lowerdeck/canonicalize
pnpm add @lowerdeck/canonicalize
```

## Usage

```typescript
import { canonicalize } from '@lowerdeck/canonicalize';

// Consistent JSON regardless of key order
const obj1 = { b: 2, a: 1 };
const obj2 = { a: 1, b: 2 };

canonicalize(obj1); // '{"a":1,"b":2}'
canonicalize(obj2); // '{"a":1,"b":2}' - same output

// Useful for signing and hashing
import { hash } from '@lowerdeck/hash';

async function signData(data: any) {
  const canonical = canonicalize(data);
  return await hash.sha256(canonical);
}

// Handles special types
canonicalize({
  date: new Date('2024-01-01'),
  regex: /test/g,
  bigint: 123n
});
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
