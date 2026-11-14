# `@lowerdeck/proxy`

Create a proxy object for method interception and routing. Useful for building RPC-style clients where property access and method calls are captured and forwarded.

## Installation

```bash
npm install @lowerdeck/proxy
yarn add @lowerdeck/proxy
bun add @lowerdeck/proxy
pnpm add @lowerdeck/proxy
```

## Usage

```typescript
import { proxy } from '@lowerdeck/proxy';

// Create RPC client
interface API {
  users: {
    get(id: string): Promise<User>;
    list(): Promise<User[]>;
  };
}

const api = proxy<API>(async (path, ...args) => {
  const method = path.join('.');
  return fetch('/api', {
    method: 'POST',
    body: JSON.stringify({ method, args })
  }).then(r => r.json());
});

// Method calls are captured and routed
await api.users.get('123'); // calls callback with ['users', 'get'] and ['123']
await api.users.list();     // calls callback with ['users', 'list'] and []

// Build type-safe API clients
const client = proxy<typeof serverAPI>(async (path, ...args) => {
  return rpcCall(path.join('.'), args);
});
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
