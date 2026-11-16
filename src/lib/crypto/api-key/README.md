# `@lowerdeck/api-key`

Create and parse structured API keys with embedded configuration. Supports versioning, type prefixes, and automatic validation for secure key management.

## Installation

```bash
npm install @lowerdeck/api-key
yarn add @lowerdeck/api-key
bun add @lowerdeck/api-key
pnpm add @lowerdeck/api-key
```

## Usage

```typescript
import { createApiKeyGenerator } from '@lowerdeck/api-key';

// Define your key types
const keyTypes = {
  uk: 'user_auth_token',
  ak: 'app_access_token',
  sk: 'secret_key'
} as const;

// Create a key generator
const ApiKey = createApiKeyGenerator(keyTypes, {
  prefix: 'myapp',
  secretLength: 60
});

// Create a new API key
const key = ApiKey.create({
  type: 'user_auth_token',
  config: {
    url: 'https://api.example.com'
  }
});

console.log(key.toString()); // myapp_uk_<60-char-secret><encoded-config>v1

// Parse an existing key
const parsed = ApiKey.from('myapp_uk_...');
if (parsed) {
  console.log(parsed.type); // 'user_auth_token'
  console.log(parsed.config.url); // 'https://api.example.com'
}

// Redact keys for logging
const redacted = ApiKey.redact(key);
console.log(redacted); // myapp_uk_abcd...xyz9
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
