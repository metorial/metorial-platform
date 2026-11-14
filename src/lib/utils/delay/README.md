# `@lowerdeck/delay`

Create a promise that resolves after a specified number of milliseconds. Useful for adding delays, timeouts, or implementing retry logic.

## Installation

```bash
npm install @lowerdeck/delay
yarn add @lowerdeck/delay
bun add @lowerdeck/delay
pnpm add @lowerdeck/delay
```

## Usage

```typescript
import { delay } from '@lowerdeck/delay';

// Wait for 1 second
await delay(1000);
console.log('1 second has passed');

// Add delay between retries
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i < retries - 1) {
        await delay(1000 * (i + 1)); // exponential backoff
      }
    }
  }
}

// Throttle operations
async function processItems(items: string[]) {
  for (const item of items) {
    await processItem(item);
    await delay(500); // wait 500ms between items
  }
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
