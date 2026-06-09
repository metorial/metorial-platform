# `@lowerdeck/env`

Type-safe environment variable validation. Ensure required environment variables exist and have proper types at application startup.

## Installation

```bash
npm install @lowerdeck/env
yarn add @lowerdeck/env
bun add @lowerdeck/env
pnpm add @lowerdeck/env
```

## Usage

```typescript
import { createValidatedEnv } from '@lowerdeck/env';
import { string, number, object } from '@lowerdeck/validation';

// Define environment schema
const env = createValidatedEnv(
  object({
    NODE_ENV: string().oneOf(['development', 'production', 'test']),
    PORT: number().min(1).max(65535),
    DATABASE_URL: string().url(),
    API_KEY: string().min(32),
    DEBUG: string().optional()
  })
);

// Use validated environment variables
console.log(env.PORT);         // number type
console.log(env.NODE_ENV);     // 'development' | 'production' | 'test'
console.log(env.DATABASE_URL); // validated URL string

// Throws error if validation fails
// Error: Environment variable PORT is required
// Error: Environment variable DATABASE_URL must be a valid URL
```

### With Default Values

```typescript
import { createValidatedEnv } from '@lowerdeck/env';
import { string, number, object, optional } from '@lowerdeck/validation';

const env = createValidatedEnv(
  object({
    PORT: optional(number().min(1)).default(3000),
    HOST: optional(string()).default('localhost'),
    LOG_LEVEL: optional(string().oneOf(['debug', 'info', 'warn', 'error'])).default('info')
  })
);

console.log(env.PORT); // 3000 if not set
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
