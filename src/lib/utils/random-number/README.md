# `@lowerdeck/random-number`

Generate random integers within a specified range. Simple wrapper around Math.random() with inclusive bounds.

## Installation

```bash
npm install @lowerdeck/random-number
yarn add @lowerdeck/random-number
bun add @lowerdeck/random-number
pnpm add @lowerdeck/random-number
```

## Usage

```typescript
import { randomNumber } from '@lowerdeck/random-number';

// Generate random number between 1 and 100 (inclusive)
const num = randomNumber(1, 100);

// Roll a dice
const diceRoll = randomNumber(1, 6);

// Random year in the 2000s
const year = randomNumber(2000, 2099);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
