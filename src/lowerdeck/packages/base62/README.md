# `@lowerdeck/base62`

Base62 encoding and decoding utility for converting strings and byte arrays into URL-safe, compact representations. Useful for shortening IDs, creating readable tokens, or encoding binary data.

## Installation

```bash
npm install @lowerdeck/base62
yarn add @lowerdeck/base62
bun add @lowerdeck/base62
pnpm add @lowerdeck/base62
```

## Usage

```typescript
import { base62 } from '@lowerdeck/base62';

// Encode a string
const encoded = base62.encode('hello');
console.log(encoded); // 'Kq6rA'

// Decode back to string
const decoded = base62.decode('Kq6rA');
console.log(decoded); // 'hello'

// Encode raw bytes
const bytes = new Uint8Array([72, 101, 108, 108, 111]);
const encodedBytes = base62.encode(bytes);

// Decode to raw bytes
const rawBytes = base62.decodeRaw(encodedBytes);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
