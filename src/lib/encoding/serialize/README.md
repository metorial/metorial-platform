# `@lowerdeck/serialize`

Enhanced serialization using SuperJSON to handle complex types that standard JSON cannot encode. Preserves Maps, Sets, Dates, and other non-standard JSON types.

## Installation

```bash
npm install @lowerdeck/serialize
yarn add @lowerdeck/serialize
bun add @lowerdeck/serialize
pnpm add @lowerdeck/serialize
```

## Usage

```typescript
import { serialize } from '@lowerdeck/serialize';

// Encode complex data types
const data = {
  date: new Date('2024-01-01'),
  map: new Map([['key', 'value']]),
  set: new Set([1, 2, 3]),
  undefined: undefined,
  bigint: 123n
};

const encoded = serialize.encode(data);
console.log(encoded); // JSON string with type metadata

// Decode back to original types
const decoded = serialize.decode(encoded);
console.log(decoded.date instanceof Date); // true
console.log(decoded.map instanceof Map); // true
console.log(decoded.set instanceof Set); // true

// Perfect for storing in localStorage or databases
localStorage.setItem('data', serialize.encode(data));
const restored = serialize.decode(localStorage.getItem('data'));
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
