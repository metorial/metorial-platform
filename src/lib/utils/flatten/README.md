# `@lowerdeck/flatten`

Flatten nested objects and arrays into single-level key-value pairs using dot notation for objects and bracket notation for arrays.

## Installation

```bash
npm install @lowerdeck/flatten
yarn add @lowerdeck/flatten
bun add @lowerdeck/flatten
pnpm add @lowerdeck/flatten
```

## Usage

```typescript
import { flattenObject } from '@lowerdeck/flatten';

// Flatten nested object
const nested = {
  user: {
    name: 'John',
    address: {
      city: 'New York',
      zip: '10001'
    }
  }
};

const flat = flattenObject(nested);
console.log(flat);
// {
//   'user.name': 'John',
//   'user.address.city': 'New York',
//   'user.address.zip': '10001'
// }

// Flatten arrays
const withArray = {
  users: [
    { name: 'Alice' },
    { name: 'Bob' }
  ]
};

const flatArray = flattenObject(withArray);
console.log(flatArray);
// {
//   'users[0].name': 'Alice',
//   'users[1].name': 'Bob'
// }
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
