# `@lowerdeck/merge`

Deep merge multiple objects recursively. Nested objects are merged together, while primitive values are overwritten by later sources.

## Installation

```bash
npm install @lowerdeck/merge
yarn add @lowerdeck/merge
bun add @lowerdeck/merge
pnpm add @lowerdeck/merge
```

## Usage

```typescript
import { merge } from '@lowerdeck/merge';

// Merge nested objects
const defaults = {
  server: { port: 3000, host: 'localhost' },
  database: { url: 'localhost:5432' }
};

const config = {
  server: { port: 8080 },
  database: { ssl: true }
};

const result = merge({}, defaults, config);
// {
//   server: { port: 8080, host: 'localhost' },
//   database: { url: 'localhost:5432', ssl: true }
// }

// Merge multiple sources
const merged = merge(
  {},
  { a: 1, b: { c: 2 } },
  { b: { d: 3 } },
  { b: { e: 4 } }
);
// { a: 1, b: { c: 2, d: 3, e: 4 } }

// Arrays are replaced, not merged
merge({ arr: [1, 2] }, { arr: [3, 4] }); // { arr: [3, 4] }
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
