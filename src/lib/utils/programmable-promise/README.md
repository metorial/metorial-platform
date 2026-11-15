# `@lowerdeck/programmable-promise`

Promise with externally controllable resolve and reject. Allows you to create a promise and settle it from outside, useful for complex control flow patterns.

## Installation

```bash
npm install @lowerdeck/programmable-promise
yarn add @lowerdeck/programmable-promise
bun add @lowerdeck/programmable-promise
pnpm add @lowerdeck/programmable-promise
```

## Usage

```typescript
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';

// Create a promise you can control externally
const pp = new ProgrammablePromise<string>();

// Pass the promise around
setTimeout(() => {
  pp.resolve('Hello!');
}, 1000);

const result = await pp.promise;
console.log(result); // 'Hello!'

// Useful for event-driven flows
class EventHandler {
  private completion = new ProgrammablePromise<void>();

  onComplete() {
    return this.completion.promise;
  }

  handleEvent(event: Event) {
    if (event.type === 'done') {
      this.completion.resolve();
    }
  }
}

// Access resolved value without awaiting
const pp2 = new ProgrammablePromise<number>();
pp2.resolve(42);
console.log(pp2.value); // 42
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
