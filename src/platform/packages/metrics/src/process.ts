import { registry } from './registry';

let installed = false;

export let installProcessMetrics = (opts: { service: string }) => {
  if (installed) return;
  installed = true;

  let startedAt = Date.now();

  registry
    .gauge({
      name: 'metorial_build_info',
      help: 'Build information of this process; the value is always 1.',
      labelNames: ['service', 'version', 'edition']
    })
    .set(
      {
        service: opts.service,
        version: process.env.METORIAL_VERSION ?? process.env.APP_VERSION ?? 'unknown',
        edition: process.env.METORIAL_EDITION ?? 'unknown'
      },
      1
    );

  let cpu = registry.counter({
    name: 'process_cpu_seconds_total',
    help: 'Total user and system CPU time spent in seconds.'
  });
  let resident = registry.gauge({
    name: 'process_resident_memory_bytes',
    help: 'Resident memory size in bytes.'
  });
  let heapUsed = registry.gauge({
    name: 'process_heap_used_bytes',
    help: 'JavaScript heap in use in bytes.'
  });
  let heapTotal = registry.gauge({
    name: 'process_heap_total_bytes',
    help: 'JavaScript heap reserved in bytes.'
  });
  let start = registry.gauge({
    name: 'process_start_time_seconds',
    help: 'Start time of the process since the unix epoch in seconds.'
  });
  let lag = registry.gauge({
    name: 'process_eventloop_lag_seconds',
    help: 'Longest event loop delay observed since the last scrape.'
  });

  start.set(undefined, startedAt / 1000);

  let maxLag = 0;
  let interval = 250;
  let expected = performance.now() + interval;
  let timer = setInterval(() => {
    let now = performance.now();
    maxLag = Math.max(maxLag, Math.max(0, now - expected) / 1000);
    expected = now + interval;
  }, interval);
  timer.unref?.();

  registry.onCollect(() => {
    let usage = process.cpuUsage();
    cpu.setTotal(undefined, (usage.user + usage.system) / 1e6);

    let memory = process.memoryUsage();
    resident.set(undefined, memory.rss);
    heapUsed.set(undefined, memory.heapUsed);
    heapTotal.set(undefined, memory.heapTotal);

    lag.set(undefined, maxLag);
    maxLag = 0;
  });
};
