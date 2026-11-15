# `@lowerdeck/unique`

Remove duplicate values from arrays using Set-based deduplication. Preserves the first occurrence of each unique value.

## Installation

```bash
npm install @lowerdeck/unique
yarn add @lowerdeck/unique
bun add @lowerdeck/unique
pnpm add @lowerdeck/unique
```

## Usage

```typescript
import { unique } from '@lowerdeck/unique';

// Remove duplicate numbers
const numbers = unique([1, 2, 2, 3, 3, 3, 4]);
console.log(numbers); // [1, 2, 3, 4]

// Remove duplicate strings
const tags = unique(['javascript', 'typescript', 'javascript', 'react']);
console.log(tags); // ['javascript', 'typescript', 'react']

// Works with any value that can be compared with Set
const mixed = unique([1, '1', 2, '2', 1, 2]);
console.log(mixed); // [1, '1', 2, '2']
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
