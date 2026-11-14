# `@lowerdeck/queue`

Reliable job queue built on BullMQ and Redis. Add jobs to a persistent queue and process them with automatic retries, concurrency control, and graceful shutdown.

## Installation

```bash
npm install @lowerdeck/queue
yarn add @lowerdeck/queue
bun add @lowerdeck/queue
pnpm add @lowerdeck/queue
```

## Usage

```typescript
import { createQueue, runQueueProcessors } from '@lowerdeck/queue';

// Create a queue
const emailQueue = createQueue<{ to: string; subject: string; body: string }>({
  name: 'email-queue',
  redisUrl: 'redis://localhost:6379',
  workerOpts: {
    concurrency: 10 // process up to 10 jobs concurrently
  }
});

// Add jobs to the queue
await emailQueue.add({
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Welcome to our service!'
});

// Add multiple jobs at once
await emailQueue.addMany([
  { to: 'user1@example.com', subject: 'Hello', body: 'Message 1' },
  { to: 'user2@example.com', subject: 'Hello', body: 'Message 2' }
]);

// Add job with options
await emailQueue.add(
  { to: 'user@example.com', subject: 'Reminder', body: 'Don\'t forget!' },
  { delay: 60000 } // delay by 1 minute
);

// Process jobs
const processor = emailQueue.process(async (job) => {
  console.log('Sending email to:', job.to);
  await sendEmail(job);
});

// Start the processor with graceful shutdown
await runQueueProcessors([processor]);

// Wait for a job to finish
const jobHandle = await emailQueue.add({ to: 'test@example.com', subject: 'Test', body: 'Test' });
await jobHandle.waitUntilFinished();

// Combine multiple queue processors
import { combineQueueProcessors } from '@lowerdeck/queue';

const combined = combineQueueProcessors([
  emailQueue.process(handleEmail),
  notificationQueue.process(handleNotification)
]);

const { close } = await combined.start();
// Later: await close();
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
