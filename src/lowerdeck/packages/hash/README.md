# `@lowerdeck/hash`

Cryptographic hash functions using Web Crypto API. Returns base62-encoded hash strings for compact, URL-safe representations.

## Installation

```bash
npm install @lowerdeck/hash
yarn add @lowerdeck/hash
bun add @lowerdeck/hash
pnpm add @lowerdeck/hash
```

## Usage

```typescript
import { Hash } from '@lowerdeck/hash';

// SHA-256 hash
const hash256 = await Hash.sha256('hello world');
console.log(hash256); // base62-encoded hash

// Different hash algorithms
const hash1 = await Hash.sha1('data');
const hash384 = await Hash.sha384('data');
const hash512 = await Hash.sha512('data');

// Hash user passwords (use dedicated password hashing in production)
async function hashPassword(password: string) {
  return await Hash.sha512(password);
}

// Create content-based IDs
async function createContentHash(content: string) {
  return await Hash.sha256(content);
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
