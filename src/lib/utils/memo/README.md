# `@lowerdeck/memo`

Memoization decorator that caches function results based on arguments. Returns cached results for subsequent calls with the same arguments.

## Installation

```bash
npm install @lowerdeck/memo
yarn add @lowerdeck/memo
bun add @lowerdeck/memo
pnpm add @lowerdeck/memo
```

## Usage

```typescript
import { memo } from '@lowerdeck/memo';

// Memoize expensive computation
const fibonacci = memo((n: number): number => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
});

fibonacci(40); // computed
fibonacci(40); // returned from cache

// Memoize API calls
const fetchUser = memo(async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

await fetchUser('123'); // makes API call
await fetchUser('123'); // returns cached result
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
