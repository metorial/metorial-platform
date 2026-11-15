# `@lowerdeck/random-from-array`

Pick a random element from an array. Returns null if the array is empty.

## Installation

```bash
npm install @lowerdeck/random-from-array
yarn add @lowerdeck/random-from-array
bun add @lowerdeck/random-from-array
pnpm add @lowerdeck/random-from-array
```

## Usage

```typescript
import { randomFromArray } from '@lowerdeck/random-from-array';

// Pick a random fruit
const fruit = randomFromArray(['apple', 'banana', 'orange']);
console.log(fruit); // 'banana' (or any random element)

// Empty array returns null
const empty = randomFromArray([]);
console.log(empty); // null

// Works with any type
const user = randomFromArray([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' }
]);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
