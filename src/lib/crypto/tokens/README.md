# `@lowerdeck/tokens`

Create and verify signed tokens with HMAC or asymmetric cryptography. Supports expiration checking and type validation with a clean token format.

## Installation

```bash
npm install @lowerdeck/tokens
yarn add @lowerdeck/tokens
bun add @lowerdeck/tokens
pnpm add @lowerdeck/tokens
```

## Usage

```typescript
import { Tokens } from '@lowerdeck/tokens';

// Create token manager with HMAC-SHA384
const tokens = new Tokens({
  alg: 'HS384',
  secret: 'your-secret-key'
});

// Sign a token
const token = await tokens.sign({
  type: 'reset-password',
  data: { userId: '123', email: 'user@example.com' },
  expiresAt: new Date(Date.now() + 3600000) // 1 hour
});
console.log(token); // 'reset-password_v1_eyJ1c2VySWQi..._xyz123'

// Verify and decode
const result = await tokens.verify({
  token,
  expectedType: 'reset-password'
});

if (result.success) {
  console.log(result.data); // { userId: '123', email: '...' }
} else {
  console.log(result.error); // 'expired', 'invalid-signature', 'wrong-type'
}

// Asymmetric signing (RS256, ES384)
const rsaTokens = new Tokens({
  alg: 'RS256',
  privateKey: privateKeyPEM,
  publicKey: publicKeyPEM
});
```

## Token Format

Tokens follow the format: `type_v1_data_signature`

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
