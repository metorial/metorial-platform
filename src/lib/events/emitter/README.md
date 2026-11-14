# `@lowerdeck/emitter`

Type-safe event emitter with strong typing. Define your event types upfront and get full TypeScript support for event names and payloads.

## Installation

```bash
npm install @lowerdeck/emitter
yarn add @lowerdeck/emitter
bun add @lowerdeck/emitter
pnpm add @lowerdeck/emitter
```

## Usage

```typescript
import { Emitter } from '@lowerdeck/emitter';

// Define event types
type Events = {
  'user:login': { userId: string; timestamp: Date };
  'user:logout': { userId: string };
  'error': Error;
};

const emitter = new Emitter<Events>();

// Subscribe to events (returns unsubscribe function)
const unsubscribe = emitter.on('user:login', (data) => {
  console.log(`User ${data.userId} logged in`);
});

// Emit events
emitter.emit('user:login', {
  userId: '123',
  timestamp: new Date()
});

// One-time listeners
emitter.once('error', (error) => {
  console.error('Error occurred:', error);
});

// Unsubscribe
unsubscribe();

// Clear all listeners
emitter.clear();
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
