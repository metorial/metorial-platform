import { isServiceError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { createAgentTrackingClient } from '@mtsrc/agent-tracking-client-internal';
import { agentTrackingSettings } from '../env';

export type AgentTracking = ReturnType<typeof createAgentTrackingClient>;

export type AgentTrackingCallOpts = Parameters<AgentTracking['instance']['upsert']>[1];

let client: AgentTracking | undefined;

export let isAgentTrackingEnabled = () => !!agentTrackingSettings.url;

export let getAgentTrackingIngestPublicUrl = () =>
  agentTrackingSettings.ingestPublicUrl ?? null;

// The client is an RPC proxy that answers every property, `then` included, so it is a thenable:
// returning it from an async function or a Service method sends an RPC named `then` and never
// settles. Hand it out synchronously only.
export let getAgentTracking = () => {
  let endpoint = agentTrackingSettings.url;
  if (!endpoint) return null;

  client ??= createAgentTrackingClient({ endpoint });

  return client;
};

let notConfiguredError = () =>
  new ServiceError(preconditionFailedError({ message: 'Agent tracking is not configured.' }));

export let requireAgentTracking = () => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) throw notConfiguredError();

  return agentTracking;
};

export let requireIngestUrl = () => {
  let ingestUrl = getAgentTrackingIngestPublicUrl();
  if (!ingestUrl) throw notConfiguredError();

  return ingestUrl;
};

// Archiving something the service no longer has (or already archived) is the goal state.
export let ignoreNotFound = async <T>(promise: Promise<T>) => {
  try {
    return await promise;
  } catch (error) {
    if (isServiceError(error) && error.data.status == 404) return null;
    throw error;
  }
};
