# `@lowerdeck/once`

Ensure a function is called only once, returning the cached result on subsequent calls. Useful for initialization functions or expensive operations that should run exactly once.

## Installation

```bash
npm install @lowerdeck/once
yarn add @lowerdeck/once
bun add @lowerdeck/once
pnpm add @lowerdeck/once
```

## Usage

```typescript
import { once } from '@lowerdeck/once';

// Initialize database connection once
const initDatabase = once(() => {
  console.log('Connecting to database...');
  return createConnection();
});

initDatabase(); // logs "Connecting to database..."
initDatabase(); // returns cached connection, no log

// Lazy computation
const getExpensiveValue = once(() => {
  console.log('Computing...');
  return complexCalculation();
});

const value1 = getExpensiveValue(); // logs "Computing..."
const value2 = getExpensiveValue(); // returns cached value
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
