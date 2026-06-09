# `@lowerdeck/snowflake`

Generate distributed unique IDs using Twitter's Snowflake algorithm. Snowflake IDs are 64-bit integers that are sortable by time and guaranteed to be unique across distributed systems.

## Installation

```bash
npm install @lowerdeck/snowflake
yarn add @lowerdeck/snowflake
bun add @lowerdeck/snowflake
pnpm add @lowerdeck/snowflake
```

## Usage

### Basic Usage

```typescript
import { Worker } from '@lowerdeck/snowflake';

// Create a worker with default settings
const worker = new Worker({
  workerId: 1n,
  datacenterId: 1n
});

// Generate unique IDs
const id1 = worker.nextId();
const id2 = worker.nextId();

console.log(id1); // 1234567890123456789n
console.log(id2); // 1234567890123456790n
```

### Custom Configuration

```typescript
import { Worker } from '@lowerdeck/snowflake';

// Customize the Snowflake generator
const worker = new Worker({
  workerId: 5n,
  datacenterId: 3n,
  epoch: new Date('2024-01-01T00:00:00Z'), // Custom epoch
  workerIdBits: 5n,      // 5 bits for worker ID (default: 5)
  datacenterIdBits: 5n,  // 5 bits for datacenter ID (default: 5)
  sequenceBits: 12n,     // 12 bits for sequence (default: 12)
  initialSequence: 0n    // Starting sequence number
});

const id = worker.nextId();
```

### Accessing Worker State

```typescript
const worker = new Worker({
  workerId: 1n,
  datacenterId: 2n
});

// Access worker information
console.log(worker.workerId);         // 1n
console.log(worker.datacenterId);     // 2n
console.log(worker.currentSequence);  // Current sequence number
console.log(worker.lastTimestamp);    // Last generated timestamp
```

## How It Works

Snowflake IDs are 64-bit integers composed of:

- **Timestamp** (41 bits): Milliseconds since the custom epoch
- **Datacenter ID** (5 bits): Identifies the datacenter (0-31)
- **Worker ID** (5 bits): Identifies the worker within a datacenter (0-31)
- **Sequence** (12 bits): Incremental counter for IDs generated in the same millisecond (0-4095)

This structure allows:
- **Time-sortable IDs**: IDs generated later have higher values
- **Distributed generation**: Different workers can generate IDs without coordination
- **High throughput**: Up to 4096 IDs per millisecond per worker
- **69 years of IDs**: From the custom epoch (default: January 1, 2021)

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workerId` | `bigint \| number` | Required | Worker identifier (0-31 with default bit length) |
| `datacenterId` | `bigint \| number` | Required | Datacenter identifier (0-31 with default bit length) |
| `epoch` | `Date` | `new Date('2021-01-01')` | Custom epoch for timestamp calculation |
| `workerIdBits` | `bigint \| number` | `5n` | Number of bits for worker ID |
| `datacenterIdBits` | `bigint \| number` | `5n` | Number of bits for datacenter ID |
| `sequenceBits` | `bigint \| number` | `12n` | Number of bits for sequence counter |
| `initialSequence` | `bigint \| number` | `0n` | Initial sequence number |

## Error Handling

The generator will throw errors in these cases:

```typescript
// Clock moved backwards
try {
  const id = worker.nextId();
} catch (error) {
  console.error(error); // "Clock moved backwards. Cannot generate new ID for X milliseconds."
}

// Invalid worker or datacenter ID
try {
  const worker = new Worker({
    workerId: 999n, // Too large for 5 bits
    datacenterId: 1n
  });
} catch (error) {
  console.error(error); // "With 5 bits, worker id must be between 0 and 31"
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
