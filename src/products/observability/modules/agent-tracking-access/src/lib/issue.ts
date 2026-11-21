import type { Instance, Organization, Project } from '@metorial/db';
import {
  assertAgentTrackingEnabled,
  requireAgentTracking,
  requireIngestUrl,
  withInstanceScope,
  type AgentTracking,
  type AgentTrackingCallOpts
} from '@metorial/module-agent-tracking-sync';

// Not retried: a retry after a lost response would issue a second key nobody holds.
let scopeCallOpts: AgentTrackingCallOpts = { timeoutMs: 3_000 };
export let issueCallOpts: AgentTrackingCallOpts = { timeoutMs: 5_000, retry: false };

export let issueInScope = async <T>(d: {
  organization: Organization;
  project: Project;
  instance: Instance;
  entity: string;
  beforeChange?: () => Promise<unknown>;
  create: (agentTracking: AgentTracking) => Promise<T>;
}) => {
  let agentTracking = requireAgentTracking();
  let ingestUrl = requireIngestUrl();

  await assertAgentTrackingEnabled(d);
  await d.beforeChange?.();

  let created = await withInstanceScope(
    {
      organization: d.organization,
      project: d.project,
      instance: d.instance,
      callOpts: scopeCallOpts
    },
    () => d.create(agentTracking)
  );

  return { agentTracking, created, ingestUrl };
};
