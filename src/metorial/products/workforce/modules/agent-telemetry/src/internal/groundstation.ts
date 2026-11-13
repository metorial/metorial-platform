import { isServiceError } from '@lowerdeck/error';
import { createGroundstationClient } from '@metorial-platform-systems/groundstation-client';
import { agentTelemetrySettings } from '../env';

export type Groundstation = ReturnType<typeof createGroundstationClient>;

let client: Groundstation | undefined;

export let isAgentTelemetryEnabled = () => !!agentTelemetrySettings.groundstationUrl;

export let getGroundstation = () => {
  let endpoint = agentTelemetrySettings.groundstationUrl;
  if (!endpoint) return null;

  client ??= createGroundstationClient({ endpoint });

  return client;
};

// Archiving something Groundstation no longer has (or already archived) is the goal state.
export let ignoreNotFound = async <T>(promise: Promise<T>) => {
  try {
    return await promise;
  } catch (error) {
    if (isServiceError(error) && error.data.status == 404) return null;
    throw error;
  }
};
