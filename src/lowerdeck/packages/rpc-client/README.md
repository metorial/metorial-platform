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

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
