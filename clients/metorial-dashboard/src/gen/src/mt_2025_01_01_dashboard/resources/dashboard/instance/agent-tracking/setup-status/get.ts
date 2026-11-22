import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingSetupStatusGetOutput = {
  object: 'agent_tracking.setup_status';
  lastReceivedAt: Date | null;
  options: {
    usageAndCost: 'detected' | 'not_detected' | 'undetectable';
    keepLocalHistory: 'detected' | 'not_detected' | 'undetectable';
    repository: 'detected' | 'not_detected' | 'undetectable';
    toolDetails: 'detected' | 'not_detected' | 'undetectable';
    hooks: 'detected' | 'not_detected' | 'undetectable';
  };
};

export let mapDashboardInstanceAgentTrackingSetupStatusGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSetupStatusGetOutput>(
    [
      'last_received_at',
      [
        'options',
        0,
        [1, ['usage_and_cost', 'keep_local_history', 'tool_details']]
      ]
    ],
    1
  );
