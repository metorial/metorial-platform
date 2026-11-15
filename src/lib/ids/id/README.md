# `@lowerdeck/id`

Generate various types of unique IDs with prefixes. Supports sorted IDs with timestamps, unsorted random IDs, key IDs with checksums, and Snowflake-style distributed IDs.

## Installation

```bash
npm install @lowerdeck/id
yarn add @lowerdeck/id
bun add @lowerdeck/id
pnpm add @lowerdeck/id
```

## Usage

### Sorted IDs (with timestamp)

```typescript
import { generateId } from '@lowerdeck/id';

// Generate sorted ID with timestamp prefix
const id = generateId('user', 16);
console.log(id); // 'user_01HQRS9Z3K7M2N5P'

// IDs are sortable by creation time
const id1 = generateId('order');
const id2 = generateId('order');
console.log(id1 < id2); // true
```

### Unsorted Random IDs

```typescript
import { generateCustomId } from '@lowerdeck/id';

// Generate random ID
const id = generateCustomId('session', 24);
console.log(id); // 'session_abc123xyz789'

// Without prefix
const randomId = generateCustomId(undefined, 16);
```

### Plain IDs and Codes

```typescript
import { generatePlainId, generateCode } from '@lowerdeck/id';

// Alphanumeric string
const plainId = generatePlainId(12);
console.log(plainId); // 'aBc123XyZ456'

// Numeric code
const code = generateCode(6);
console.log(code); // '123456'
```

### Snowflake IDs

```typescript
import { generateSnowflakeId } from '@lowerdeck/id';

// Generate distributed ID
const snowflake = generateSnowflakeId('sf');
console.log(snowflake); // 'sf_1234567890123456789'
```

### Type-safe ID Generator

```typescript
import { createIdGenerator } from '@lowerdeck/id';

const ids = createIdGenerator({
  user: 'user',
  order: 'order',
  session: 'session'
});

// Type-safe ID generation
const userId = ids.user(); // 'user_...'
const orderId = ids.order(); // 'order_...'
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
