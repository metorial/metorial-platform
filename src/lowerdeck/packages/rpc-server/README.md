# `@lowerdeck/rpc-server`

Type-safe RPC server for handling remote procedure calls. Provides automatic validation, error handling, execution context tracking, and Sentry integration.

## Installation

```bash
npm install @lowerdeck/rpc-server
yarn add @lowerdeck/rpc-server
bun add @lowerdeck/rpc-server
pnpm add @lowerdeck/rpc-server
```

## Usage

```typescript
import { createRpcServer } from '@lowerdeck/rpc-server';

// Define your API implementation
const api = {
  getUser: async (id: string) => {
    return { name: 'John Doe', email: 'john@example.com' };
  },

  createPost: async (data: { title: string; content: string }) => {
    return { id: 'post_123' };
  }
};

// Create the RPC server
const server = createRpcServer({
  controllers: { api },
  context: async (req) => ({
    userId: req.headers.get('user-id')
  })
});

// Use with your HTTP framework
app.post('/rpc', server.handler);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
