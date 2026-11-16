# `@lowerdeck/cron`

Distributed cron job scheduler using BullMQ and Redis. Schedule recurring tasks with cron expressions that run reliably across multiple instances.

## Installation

```bash
npm install @lowerdeck/cron
yarn add @lowerdeck/cron
bun add @lowerdeck/cron
pnpm add @lowerdeck/cron
```

## Usage

```typescript
import { createCron } from '@lowerdeck/cron';

// Create a cron job that runs every minute
const cronJob = createCron(
  {
    name: 'cleanup-task',
    cron: '*/1 * * * *', // every minute
    redisUrl: 'redis://localhost:6379'
  },
  async () => {
    console.log('Running cleanup task');
    // Your task logic here
  }
);

// Start the cron job
const processor = await cronJob.start();

// Later, stop the cron job
await processor.close();

// Run every day at midnight
const dailyJob = createCron(
  {
    name: 'daily-report',
    cron: '0 0 * * *',
    redisUrl: process.env.REDIS_URL
  },
  async () => {
    await generateDailyReport();
  }
);

// Run every 15 minutes
const frequentJob = createCron(
  {
    name: 'sync-data',
    cron: '*/15 * * * *',
    redisUrl: process.env.REDIS_URL
  },
  async () => {
    await syncDataFromAPI();
  }
);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
