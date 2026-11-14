import { isServiceError } from '@lowerdeck/error';
import {
  createClusterManagerClient,
  type ClusterManagerClient,
  type ClusterManagerErrorCode
} from '@metorial-platform-systems/cluster-manager-client';
import { env } from '../../env';

let CONTROL_TIMEOUT_MS = 2 * 60 * 1000;

let client: ClusterManagerClient | undefined;

export let getClusterManager = () => {
  let endpoint = env.clusterManager.CLUSTER_MANAGER_URL;
  if (!endpoint) throw new Error('CLUSTER_MANAGER_URL is not configured');

  client ??= createClusterManagerClient({
    endpoint,
    tokenFile: env.clusterManager.CLUSTER_MANAGER_TOKEN_FILE,
    timeoutMs: CONTROL_TIMEOUT_MS
  });

  return client;
};

export let getClusterManagerErrorCode = (err: unknown) =>
  isServiceError(err) ? (err.data.code as ClusterManagerErrorCode | string) : undefined;
