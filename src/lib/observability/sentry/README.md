# `@lowerdeck/sentry`

Lightweight wrapper for managing Sentry instances across your application. Provides a global reference that can be configured and accessed throughout your codebase.

## Installation

```bash
npm install @lowerdeck/sentry
yarn add @lowerdeck/sentry
bun add @lowerdeck/sentry
pnpm add @lowerdeck/sentry
```

## Usage

```typescript
import { setSentry, getSentry } from '@lowerdeck/sentry';
import * as Sentry from '@sentry/node';

// Initialize Sentry in your application
Sentry.init({
  dsn: 'your-dsn-here',
  environment: 'production'
});

// Set the Sentry instance
setSentry(Sentry);

// Access Sentry from anywhere in your application
const sentry = getSentry();
sentry.captureException(new Error('Something went wrong'));

// In other modules
import { getSentry } from '@lowerdeck/sentry';

function logError(error: Error) {
  const sentry = getSentry();
  sentry.captureException(error);
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
