# `@lowerdeck/sign`

HMAC signing and verification with expiration support. Uses HMAC-SHA512 and base62 encoding for secure, compact signatures.

## Installation

```bash
npm install @lowerdeck/sign
yarn add @lowerdeck/sign
bun add @lowerdeck/sign
pnpm add @lowerdeck/sign
```

## Usage

### With Expiration

```typescript
import { signature } from '@lowerdeck/sign';

const signer = signature({
  prefix: 'token',
  expirationMs: 3600000, // 1 hour
  key: 'your-secret-key'
});

// Sign data with expiration
const signed = await signer.sign('user-123');
console.log(signed); // 'token_xyz123abc...'

// Verify signature
const verified = await signer.verify(signed);
if (verified) {
  console.log('Valid signature');
} else {
  console.log('Invalid or expired signature');
}
```

### Without Expiration

```typescript
import { signatureBasic } from '@lowerdeck/sign';

// Simple signing without expiration
const signed = await signatureBasic.sign('data', 'secret-key');
console.log(signed); // 'data.xyz123abc...'

const isValid = await signatureBasic.verify(signed, 'secret-key');
console.log(isValid); // true
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
