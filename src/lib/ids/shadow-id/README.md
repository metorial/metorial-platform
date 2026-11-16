# `@lowerdeck/shadow-id`

Generate consistent, unique shadow IDs based on input data. Combines SHA256 hashing, base62 encoding, and timestamp extraction for deterministic ID generation.

## Installation

```bash
npm install @lowerdeck/shadow-id
yarn add @lowerdeck/shadow-id
bun add @lowerdeck/shadow-id
pnpm add @lowerdeck/shadow-id
```

## Usage

```typescript
import { shadowId } from '@lowerdeck/shadow-id';

// Generate shadow ID from user data
const id = await shadowId(
  'user',                           // prefix
  ['session-123', 'device-456'],    // IDs to combine
  ['john@example.com', 1234567890]  // additional data
);
console.log(id); // 'user_xY9zK1mN2pQ3r4s5...'

// Same inputs always produce the same ID
const id1 = await shadowId('user', ['123'], ['john@example.com']);
const id2 = await shadowId('user', ['123'], ['john@example.com']);
console.log(id1 === id2); // true

// Different inputs produce different IDs
const id3 = await shadowId('user', ['456'], ['jane@example.com']);
console.log(id1 !== id3); // true

// Useful for creating deterministic anonymous IDs
const anonymousUserId = await shadowId(
  'anon',
  [sessionId, deviceId],
  [ipAddress, userAgent]
);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
