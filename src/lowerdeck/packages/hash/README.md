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

## Content hashes (Node and Bun only)

`@lowerdeck/hash/content` hashes file content in one pass: hex sha256, the git blob SHA
(`sha1("blob <size>\0" + bytes)`), the unsigned crc32 and the byte size.

```typescript
import { createContentHasher, hashBytes, hashStream } from '@lowerdeck/hash/content';

hashBytes('hello\n').gitBlobSha; // ce013625030ba8dba906f756967f9e9ca394464a

let hasher = createContentHasher({ size: expectedSize });
for await (let chunk of stream) hasher.update(chunk);
let { sha256, gitBlobSha, crc32, size } = hasher.digest(); // ContentSizeMismatchError if size differs
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
