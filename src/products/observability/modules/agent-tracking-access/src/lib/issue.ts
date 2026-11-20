import type { Instance, Organization, Project } from '@metorial/db';
import {
  agentTrackingSyncService,
  assertAgentTrackingEnabled,
  requireAgentTracking,
  requireIngestUrl,
  type AgentTrackingCallOpts
} from '@metorial/module-agent-tracking-sync';

// Issuing runs on a request path, so each call is bounded. A retry after a lost response would
// issue a second key nobody holds.
let scopeCallOpts: AgentTrackingCallOpts = { timeoutMs: 3_000 };
export let issueCallOpts: AgentTrackingCallOpts = { timeoutMs: 5_000, retry: false };

export let prepareIssue = async (d: {
  organization: Organization;
  project: Project;
  instance: Instance;
  entity: string;
  beforeChange?: () => Promise<unknown>;
}) => {
  let agentTracking = requireAgentTracking();
  let ingestUrl = requireIngestUrl();

  await assertAgentTrackingEnabled(d);
  await d.beforeChange?.();

  await agentTrackingSyncService.upsertInstanceScope({
    organization: d.organization,
    project: d.project,
    instance: d.instance,
    callOpts: scopeCallOpts
  });

  return { agentTracking, ingestUrl };
};
