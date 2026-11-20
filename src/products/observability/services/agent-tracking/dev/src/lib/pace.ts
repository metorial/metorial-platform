import type { Clock } from './clock';

export type Pace = { wait: (organizationId: string) => Promise<void> };

export let createOrganizationPace = (perMinute: number, clock: Clock): Pace => {
  let history = new Map<string, number[]>();

  return {
    wait: async organizationId => {
      let calls = history.get(organizationId) ?? [];
      let now = clock.now();

      while (calls.length && calls[0]! <= now - 60_000) calls.shift();

      if (calls.length >= perMinute) {
        await clock.sleep(calls[0]! + 60_000 - now);
        now = clock.now();
        calls.shift();
      }

      calls.push(now);
      history.set(organizationId, calls);
    }
  };
};

export let retryAfterMsOf = (error: unknown) => {
  let data = (
    error as { data?: { retry_after_seconds?: number; status?: number; code?: string } }
  ).data;

  if (data?.status != 429 && data?.code != 'too_many_requests') return null;

  return (data?.retry_after_seconds ?? 1) * 1000;
};
