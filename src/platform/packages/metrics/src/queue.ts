import { queueObserver } from '@lowerdeck/queue';
import { Gauge, registry } from './registry';

let installed = false;
let cacheTtlMs = 15_000;
let concurrency = 8;

export let installQueueMetrics = () => {
  if (installed) return;
  installed = true;

  let jobDuration = registry.histogram({
    name: 'metorial_queue_job_duration_seconds',
    help: 'Processing time of queue jobs, by queue and outcome.',
    labelNames: ['queue', 'outcome'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300, 900]
  });
  let jobWait = registry.histogram({
    name: 'metorial_queue_job_wait_seconds',
    help: 'Time jobs waited in the queue before a worker picked them up.',
    labelNames: ['queue'],
    buckets: [0.01, 0.1, 0.5, 1, 5, 15, 60, 300, 900, 3600]
  });
  let jobs: Gauge = registry.gauge({
    name: 'metorial_queue_jobs',
    help: 'Jobs per queue and state. Reported by every worker replica; aggregate with max by (queue, state).',
    labelNames: ['queue', 'state']
  });
  let oldest: Gauge = registry.gauge({
    name: 'metorial_queue_oldest_waiting_job_age_seconds',
    help: 'Age of the oldest waiting job per queue. Aggregate with max by (queue).',
    labelNames: ['queue']
  });

  queueObserver.onJob = event => {
    jobDuration.observe({ queue: event.queue, outcome: event.outcome }, event.durationSeconds);
    if (event.waitSeconds !== undefined && event.attempt === 1) {
      jobWait.observe({ queue: event.queue }, event.waitSeconds);
    }
  };

  let cache: {
    at: number;
    rows: Array<
      [string, Awaited<ReturnType<NonNullable<ReturnType<typeof queueObserver.stats.get>>>>]
    >;
  } = {
    at: 0,
    rows: []
  };

  registry.onCollect(async () => {
    if (Date.now() - cache.at > cacheTtlMs) {
      let entries = [...queueObserver.stats.entries()];
      let rows: typeof cache.rows = [];

      for (let i = 0; i < entries.length; i += concurrency) {
        let batch = entries.slice(i, i + concurrency);
        let results = await Promise.allSettled(batch.map(([, read]) => read()));
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') rows.push([batch[index]![0], result.value]);
        });
      }

      cache = { at: Date.now(), rows };
    }

    jobs.clear();
    oldest.clear();
    for (let [queue, stats] of cache.rows) {
      for (let [state, count] of Object.entries(stats.counts)) {
        jobs.set({ queue, state }, count);
      }
      oldest.set({ queue }, stats.oldestWaitingAgeSeconds);
    }
  });
};
