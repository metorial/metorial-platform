import { useAgentTrackingIngestSources, useAgentTrackingSetupStatus } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useNow } from '@metorial/use-now';
import { formatRelativeTime } from '../../lib/formatDate';
import { useAgentTrackingAvailability } from './access';

export let agentTrackingSetupStepCount = 3;

let receivingWindowMs = 60 * 60 * 1000;

let countAgentTrackingSetupSteps = (d: { hasActiveKey: boolean; hasData: boolean }) =>
  d.hasData ? agentTrackingSetupStepCount : d.hasActiveKey ? 1 : 0;

export let useAgentTrackingSetupProgress = (instanceId: string | null | undefined) => {
  let { available } = useAgentTrackingAvailability();
  let setupStatus = useAgentTrackingSetupStatus(available ? instanceId : null);
  let activeKeys = useAgentTrackingIngestSources(available ? instanceId : null, {
    limit: 1,
    status: 'active'
  });

  let loaded = !!setupStatus.data && !!activeKeys.data;
  let hasData = !!setupStatus.data?.lastReceivedAt;
  let hasActiveKey = !!activeKeys.data?.items.length;

  return {
    loaded,
    hasData,
    hasActiveKey,
    lastReceivedAt: setupStatus.data?.lastReceivedAt ?? null,
    completedSteps: countAgentTrackingSetupSteps({ hasActiveKey, hasData })
  };
};

export let AgentTrackingStatusBadge = ({
  progress
}: {
  progress: ReturnType<typeof useAgentTrackingSetupProgress>;
}) => {
  let now = useNow();

  if (!progress.loaded) return null;

  if (progress.lastReceivedAt) {
    let lastEventAt = new Date(progress.lastReceivedAt).getTime();
    let nowMs = Math.max(now.getTime(), lastEventAt);
    let lastEvent = formatRelativeTime(lastEventAt, nowMs);
    let receiving = nowMs - lastEventAt < receivingWindowMs;

    return receiving ? (
      <Badge variant="connection" tone="connected">
        Receiving data · last event {lastEvent}
      </Badge>
    ) : (
      <Badge variant="connection" tone="available">
        Last event {lastEvent}
      </Badge>
    );
  }

  if (progress.hasActiveKey) {
    return (
      <Badge variant="connection" tone="available" loading>
        Waiting for first event
      </Badge>
    );
  }

  return (
    <Badge variant="connection" tone="available">
      No data yet
    </Badge>
  );
};
