export type HealthCheck = { name: string; run: () => Promise<unknown> };

type HealthResult = { healthy: boolean; failures: { name: string; error: unknown }[] };

let bounded = (check: HealthCheck, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    check.run(),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${check.name} did not answer within ${timeoutMs} ms`)),
        timeoutMs
      );
    })
  ]).finally(() => clearTimeout(timer));
};

export let runHealthChecks = async (
  checks: HealthCheck[],
  timeoutMs: number
): Promise<HealthResult> => {
  let results = await Promise.allSettled(checks.map(check => bounded(check, timeoutMs)));

  let failures = results.flatMap((result, index) =>
    result.status == 'rejected' ? [{ name: checks[index]!.name, error: result.reason }] : []
  );

  return { healthy: failures.length == 0, failures };
};

// A store outage after the first connection is left out on purpose: ingest answers it with a
// retryable 503, and failing every task's health check at once would only restart them all. A
// task that has never reached its store since it started is misconfigured or started into an
// outage, and after the grace period it reports unhealthy so the deployment does not settle on it.
export let storeHealthCheck = (d: {
  store: { hasConnected: () => boolean; ready: () => Promise<unknown> };
  startedAt: number;
  graceMs: number;
  now?: () => number;
}): HealthCheck => ({
  name: 'record store',
  run: async () => {
    if (d.store.hasConnected()) return;

    let attempt = d.store.ready();
    if ((d.now ?? Date.now)() - d.startedAt < d.graceMs) {
      attempt.catch(() => {});
      return;
    }

    await attempt;
  }
});
