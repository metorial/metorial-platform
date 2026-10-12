# `@lowerdeck/rpc-client`

Type-safe RPC client for making remote procedure calls. Provides automatic serialization, error handling, and request memoization.

## Installation

```bash
npm install @lowerdeck/rpc-client
yarn add @lowerdeck/rpc-client
bun add @lowerdeck/rpc-client
pnpm add @lowerdeck/rpc-client
```

## Usage

```typescript
import { createClient } from '@lowerdeck/rpc-client';

// Define your API interface
interface API {
  getUser(id: string): Promise<{ name: string; email: string }>;
  createPost(data: { title: string; content: string }): Promise<{ id: string }>;
}

// Create a type-safe client
const client = createClient<API>({
  url: 'https://api.example.com/rpc'
});

// Make RPC calls with full type safety
const user = await client.getUser('user_123');
console.log(user.name);

const post = await client.createPost({
  title: 'Hello World',
  content: 'This is my first post'
});
console.log(post.id);
```

## Timeouts, retries, and reporting

Client defaults and per-call options accept `timeoutMs`, `retry`, and `captureErrors`.
`retry: false` makes one attempt. `captureErrors: false` lets a caller with a fallback
own error reporting; it still receives the same sanitized `ServiceError`.

`getRpcRequestDiagnostics(error)` returns process-local diagnostic information for a
transport or invalid-response failure: the original diagnostic error, endpoint, method,
configured timeout, elapsed time, and attempt count. These details are held in a
`WeakMap` and are not included when the error is serialized over RPC.

The client propagates active Sentry trace headers, including when OpenTelemetry is
disabled, and preserves trace headers explicitly supplied by the caller.

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
