# `@lowerdeck/jwt`

JWT signing and verification using the jose library. Supports HS256, RS256, and ES384 algorithms with standard JWT claims.

## Installation

```bash
npm install @lowerdeck/jwt
yarn add @lowerdeck/jwt
bun add @lowerdeck/jwt
pnpm add @lowerdeck/jwt
```

## Usage

```typescript
import { JWT } from '@lowerdeck/jwt';

// Sign a JWT
const token = await JWT.sign(
  { userId: '123', role: 'admin' },
  {
    issuer: 'myapp',
    audience: 'myapp-users',
    expiresIn: '1h',
    alg: 'HS256'
  },
  'your-secret-key'
);

// Verify and decode
const payload = await JWT.verify(
  token,
  {
    issuer: 'myapp',
    audience: 'myapp-users',
    alg: 'HS256'
  },
  'your-secret-key'
);
console.log(payload); // { userId: '123', role: 'admin', iss: 'myapp', ... }

// Decode without verification
const decoded = JWT.decode(token);
console.log(decoded);

// Use RSA keys
const rsaToken = await JWT.sign(
  data,
  { alg: 'RS256', expiresIn: '24h' },
  privateKeyPEM
);

await JWT.verify(rsaToken, { alg: 'RS256' }, publicKeyPEM);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
