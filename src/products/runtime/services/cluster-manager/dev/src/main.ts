import { join } from 'node:path';
import { forward } from './forward';
import { resolveCluster } from './kube';
import { followLogs } from './logs';
import { log, stopOnSignals } from './process';
import { applyStack, buildImages, ensureKnative } from './stack';
import { mintTokens, refreshTokens } from './tokens';

let required = (key: string) => {
  let value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is not set; run this through control`);

  return value;
};

let up = async () => {
  let state = required('RUNTIME_DEV_STATE_DIR');
  let controlPort = required('RUNTIME_DEV_CONTROL_PORT');
  let networkLogsPort = required('RUNTIME_DEV_NETWORK_LOGS_PORT');
  let objectStoragePort = required('RUNTIME_DEV_OBJECT_STORAGE_PORT');

  let cluster = await resolveCluster();
  log(`using ${cluster.kind} context ${cluster.context} (${cluster.server})`);

  await ensureKnative(cluster);
  let restart = await buildImages(
    cluster,
    process.env.METORIAL_DEV_RUNTIME_SKIP_BUILD === '1'
  );
  await applyStack(cluster, { state, objectStoragePort, restart });

  let tokens = join(state, 'tokens');
  let expiresAt = await mintTokens(cluster, tokens);

  await Promise.all([
    refreshTokens(cluster, tokens, expiresAt),
    forward(cluster, 'runtime-cluster-manager', controlPort, 52240),
    forward(cluster, 'runtime-network-logs', networkLogsPort, 52250)
  ]);
};

let logs = async (app: string | undefined) => {
  if (!app) throw new Error('usage: main.ts logs <app label>');

  await followLogs(await resolveCluster(), app);
};

stopOnSignals();

let [command, argument] = process.argv.slice(2);

try {
  if (command === 'up') await up();
  else if (command === 'logs') await logs(argument);
  else throw new Error('usage: main.ts up | logs <app label>');
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
