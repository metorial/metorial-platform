# `@lowerdeck/encryption`

Encryption utility for securely encrypting and decrypting secrets using entity-specific passwords. Uses SHA-512 for key derivation and provides a simple API for secret management.

## Installation

```bash
npm install @lowerdeck/encryption
yarn add @lowerdeck/encryption
bun add @lowerdeck/encryption
pnpm add @lowerdeck/encryption
```

## Usage

```typescript
import { Encryption } from '@lowerdeck/encryption';

// Initialize with a master password
const encryption = new Encryption('master-password-123');

// Encrypt a secret for a specific entity
const encrypted = await encryption.encrypt({
  secret: 'my-api-key',
  entityId: 'user_123'
});

// Decrypt the secret
const decrypted = await encryption.decrypt({
  encrypted,
  entityId: 'user_123'
});
console.log(decrypted); // 'my-api-key'

// Different entity IDs produce different encryptions
await encryption.encrypt({
  secret: 'same-secret',
  entityId: 'user_456'
}); // Different encrypted output
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
