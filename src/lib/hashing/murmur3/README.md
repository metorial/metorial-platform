# `@lowerdeck/murmur3`

Fast, non-cryptographic hash function implementation of MurmurHash 3.0. Perfect for hash tables, bloom filters, or when you need quick consistent hashing without cryptographic guarantees.

## Installation

```bash
npm install @lowerdeck/murmur3
yarn add @lowerdeck/murmur3
bun add @lowerdeck/murmur3
pnpm add @lowerdeck/murmur3
```

## Usage

```typescript
import { murmur3_32 } from '@lowerdeck/murmur3';

// Basic hashing
const hash = murmur3_32('hello world');
console.log(hash); // 3756498238

// With custom seed for different hash variants
const hash1 = murmur3_32('hello world', 0);
const hash2 = murmur3_32('hello world', 42);
console.log(hash1 !== hash2); // true
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
