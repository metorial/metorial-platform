import { cronObserver } from '@lowerdeck/cron';
import { check, type CheckDefinition } from '@lowerdeck/doctor';
import { queueObserver, type QueueJobEvent } from '@lowerdeck/queue';

let backlogWarnSeconds = 10 * 60;
let failureWindowMs = 60 * 60_000;
let failureWarnMinimum = 10;
let failureWarnRatio = 0.2;
let cronOverdueMs = 10 * 60_000;

type Outcomes = { at: number; failed: boolean }[];

let outcomes = new Map<string, Outcomes>();
let listening = false;

let record = (event: QueueJobEvent) => {
  let now = Date.now();
  let list = outcomes.get(event.queue) ?? [];

  list.push({ at: now, failed: event.outcome == 'failed' });
  while (list.length && list[0]!.at < now - failureWindowMs) list.shift();

  outcomes.set(event.queue, list);
};

let listen = () => {
  if (listening) return;

  listening = true;
  queueObserver.listeners.add(record);
};

export let queueChecks = (): CheckDefinition[] => {
  listen();

  return [
    check({
      id: 'queues.backlog',
      title: 'Queues are being processed',
      category: 'runtime',
      severity: 'warning',
      run: async ctx => {
        if (!queueObserver.stats.size) return ctx.skip('This process runs no queue workers.');

        let stalled: { queue: string; oldestWaitingMinutes: number; waiting: number }[] = [];
        for (let [queue, stats] of queueObserver.stats) {
          let current = await stats();
          if (current.oldestWaitingAgeSeconds > backlogWarnSeconds) {
            stalled.push({
              queue,
              oldestWaitingMinutes: Math.round(current.oldestWaitingAgeSeconds / 60),
              waiting: current.counts.waiting ?? 0
            });
          }
        }

        if (!stalled.length)
          return ctx.pass(`${queueObserver.stats.size} queues are keeping up.`);

        return ctx.warn({
          message: `${stalled.length} queues have jobs waiting for more than 10 minutes: ${stalled
            .map(item => item.queue)
            .join(', ')}.`,
          resolution: {
            summary: 'Workers are not keeping up or are stuck.',
            steps: [
              'Check the worker logs for errors.',
              'Add worker replicas if the load is expected.'
            ]
          },
          details: { queues: stalled }
        });
      }
    }),

    check({
      id: 'queues.failures',
      title: 'Queue jobs succeed',
      category: 'runtime',
      severity: 'warning',
      run: ctx => {
        if (!queueObserver.stats.size) return ctx.skip('This process runs no queue workers.');

        let failing = [...outcomes]
          .map(([queue, list]) => {
            let failed = list.filter(item => item.failed).length;
            return { queue, failed, total: list.length };
          })
          .filter(
            item =>
              item.failed >= failureWarnMinimum && item.failed / item.total > failureWarnRatio
          );

        if (!failing.length)
          return ctx.pass('No queue has a high failure rate in the last hour.');

        return ctx.warn({
          message: `${failing.length} queues failed often in the last hour: ${failing
            .map(item => `${item.queue} (${item.failed} of ${item.total})`)
            .join(', ')}.`,
          resolution: { summary: 'Check the worker logs for the errors of these jobs.' },
          details: { queues: failing }
        });
      }
    }),

    check({
      id: 'cron.schedules',
      title: 'Scheduled jobs run on time',
      category: 'runtime',
      severity: 'warning',
      run: async ctx => {
        if (!cronObserver.schedules.size)
          return ctx.skip('This process runs no scheduled jobs.');

        let now = Date.now();
        let overdue: { name: string; pattern: string; overdueMinutes: number | null }[] = [];

        for (let [name, schedule] of cronObserver.schedules) {
          let current = await schedule();
          if (current.nextRunAt == null) {
            overdue.push({ name, pattern: current.pattern, overdueMinutes: null });
          } else if (current.nextRunAt < now - cronOverdueMs) {
            overdue.push({
              name,
              pattern: current.pattern,
              overdueMinutes: Math.round((now - current.nextRunAt) / 60_000)
            });
          }
        }

        if (!overdue.length)
          return ctx.pass(`${cronObserver.schedules.size} schedules are on time.`);

        return ctx.warn({
          message: `${overdue.length} scheduled jobs are overdue or missing: ${overdue.map(item => item.name).join(', ')}.`,
          resolution: {
            summary: 'Check that the workers are running and connected to Redis.'
          },
          details: { schedules: overdue }
        });
      }
    })
  ];
};

export let resetQueueOutcomes = () => outcomes.clear();
