import type { DashboardInstanceWebhooksEventsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

let WEBHOOK_EVENT_POLL_INTERVAL_MS = 3000;

export let webhookEventsLoader = createLoader({
  name: 'webhookEvents',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceWebhooksEventsListQuery) => {
    let { instanceId, ...query } = i;
    return withAuth(sdk => sdk.webhooks.events.list(instanceId, query));
  },
  mutators: {}
});

export let useWebhookEvents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceWebhooksEventsListQuery
) =>
  usePaginator(
    pagination =>
      webhookEventsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null),
    JSON.stringify(query ?? {})
  );

export let webhookEventLoader = createLoader({
  name: 'webhookEvent',
  parents: [webhookEventsLoader],
  fetch: (i: { instanceId: string; webhookEventId: string }) =>
    withAuth(sdk => sdk.webhooks.events.get(i.instanceId, i.webhookEventId)),
  mutators: {}
});

export let useWebhookEvent = (
  instanceId: string | null | undefined,
  webhookEventId: string | null | undefined,
  options?: { pollInterval?: number | null }
) => {
  let data = webhookEventLoader.use(
    instanceId && webhookEventId ? { instanceId, webhookEventId } : null
  );
  let isWaiting = data.data?.status === 'pending';
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;

  useEffect(() => {
    let pollInterval =
      options?.pollInterval === undefined
        ? WEBHOOK_EVENT_POLL_INTERVAL_MS
        : options.pollInterval;
    if (!isWaiting || pollInterval === null) return;

    let interval = window.setInterval(() => refetchRef.current(), pollInterval);
    return () => window.clearInterval(interval);
  }, [isWaiting, options?.pollInterval]);

  return data;
};
