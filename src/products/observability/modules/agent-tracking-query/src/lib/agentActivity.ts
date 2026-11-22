export type AgentActivity = {
  lastUsed: Map<string, Date>;
  complete: boolean;
};

export let consumerAgentKey = (consumerId: string, agentKey: string) =>
  `${consumerId}:${agentKey}`;

// A key missing from a truncated result may still have been used, so it stays unknown.
export let getLastUsed = (activity: AgentActivity | null, key: string) => {
  if (!activity) return null;

  let lastUsedAt = activity.lastUsed.get(key);
  if (lastUsedAt) return { lastUsedAt };

  return activity.complete ? { lastUsedAt: null } : null;
};
