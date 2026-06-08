# `@lowerdeck/event`

Event-driven architecture framework using Redis Streams. Define typed events, fire them across your system, and process them with task workers. Perfect for building scalable, decoupled microservices.

## Installation

```bash
npm install @lowerdeck/event
yarn add @lowerdeck/event
bun add @lowerdeck/event
pnpm add @lowerdeck/event
```

## Usage

### Basic Event Definition

```typescript
import { EventObject, eventObjectAction } from '@lowerdeck/event';

// Define action types
const userAction = eventObjectAction<{ userId: string }>({ type: 'user' });

// Create an event object
const userEvents = new EventObject({
  serviceName: 'my-service',
  objectName: 'user',
  redisUrl: 'redis://localhost:6379'
})
  .action(userAction('created'))
  .action(userAction('updated'))
  .action(userAction('deleted'));
```

### Firing Events

```typescript
// Fire events - they'll be sent to Redis Streams
userEvents.fire('created', { userId: 'user_123' });
userEvents.fire('updated', { userId: 'user_456' });
userEvents.fire('deleted', { userId: 'user_789' });
```

### Processing Events with Tasks

```typescript
// Create a task to process events
const processor = userEvents.task(
  {
    actionNames: ['created', 'updated'],
    taskName: 'sync-to-analytics'
  },
  async ({ payload, action }) => {
    console.log(`Processing ${action} for user ${payload.userId}`);
    // payload has type: { userId: string, type: 'user' }

    if (action === 'created') {
      await sendToAnalytics(payload);
    } else if (action === 'updated') {
      await updateAnalytics(payload);
    }
  }
);

// Start the processor
await processor.start();
```

### Multiple Event Types

```typescript
// Define multiple event types
const orderAction = eventObjectAction<{ orderId: string; amount: number }>({
  type: 'order'
});

const orderEvents = new EventObject({
  serviceName: 'ecommerce',
  objectName: 'order',
  redisUrl: process.env.REDIS_URL!
})
  .action(orderAction('placed'))
  .action(orderAction('fulfilled'))
  .action(orderAction('cancelled'))
  .action(orderAction('refunded'));

// Fire events
orderEvents.fire('placed', { orderId: 'order_123', amount: 99.99 });
orderEvents.fire('fulfilled', { orderId: 'order_123', amount: 99.99 });
```

### Processing Specific Actions

```typescript
// Process only specific actions
const emailProcessor = orderEvents.task(
  {
    actionNames: ['placed', 'fulfilled'],
    taskName: 'send-order-emails'
  },
  async ({ payload, action }) => {
    if (action === 'placed') {
      await sendOrderConfirmationEmail(payload.orderId);
    } else if (action === 'fulfilled') {
      await sendShippingEmail(payload.orderId);
    }
  }
);

const inventoryProcessor = orderEvents.task(
  {
    actionNames: ['placed', 'cancelled'],
    taskName: 'update-inventory'
  },
  async ({ payload, action }) => {
    if (action === 'placed') {
      await decrementInventory(payload.orderId);
    } else if (action === 'cancelled') {
      await incrementInventory(payload.orderId);
    }
  }
);

// Start both processors
await emailProcessor.start();
await inventoryProcessor.start();
```

### Custom Object Names

```typescript
// Override object name for specific events
userEvents.fire('created', { userId: 'user_123' }, {
  objectNameOverride: 'user-priority'
});

// Process from custom object name
const priorityProcessor = userEvents.task(
  {
    actionNames: ['created'],
    taskName: 'process-priority-users',
    objectNameOverride: 'user-priority'
  },
  async ({ payload }) => {
    await handlePriorityUser(payload.userId);
  }
);
```

## Key Features

- **Type-safe events**: Full TypeScript support with typed actions and payloads
- **Redis Streams**: Reliable event delivery using Redis Streams under the hood
- **Consumer groups**: Automatic load balancing across multiple workers
- **Concurrent processing**: Configure concurrency per task (default: 20)
- **Decoupled architecture**: Services communicate through events, not direct calls
- **Error handling**: Built-in error tracking with Sentry integration

## How It Works

1. **Define actions** using `eventObjectAction()` with typed payloads
2. **Create EventObject** instances for each domain object (user, order, etc.)
3. **Fire events** when things happen in your system
4. **Create tasks** to process events asynchronously
5. Events are sent to Redis Streams and processed by consumer groups

## Configuration

### EventObject Options

| Option | Type | Description |
|--------|------|-------------|
| `serviceName` | `string` | Name of your service (used for stream naming) |
| `objectName` | `string` | Name of the object type (e.g., 'user', 'order') |
| `redisUrl` | `string` | Redis connection URL |

### Task Options

| Option | Type | Description |
|--------|------|-------------|
| `actionNames` | `string[]` | Array of action names to process (at least one required) |
| `taskName` | `string` | Unique name for this task/consumer group |
| `objectNameOverride` | `string?` | Optional override for the object name |

## Best Practices

1. **Keep payloads small**: Only include essential data in event payloads
2. **Use descriptive action names**: Make it clear what happened (e.g., 'user.created' vs 'created')
3. **Handle errors gracefully**: Tasks should be idempotent in case of retries
4. **Monitor your streams**: Check Redis Stream lengths to detect processing delays
5. **Scale horizontally**: Run multiple instances of task processors for high throughput

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
