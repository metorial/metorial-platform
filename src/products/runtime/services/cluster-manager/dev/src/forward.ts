import type { LocalCluster } from './cluster';
import { platformNamespace } from './kube';
import { isStopping, log, sleep, spawnInherited } from './process';

let restartDelayMs = 1_000;

// kubectl port-forward pins one pod and exits when it goes away; keep reopening it.
export let forward = async (
  cluster: LocalCluster,
  service: string,
  local: string,
  remote: number
) => {
  log(`forwarding 127.0.0.1:${local} to ${service}:${remote}`);

  while (!isStopping()) {
    let child = spawnInherited([
      'kubectl',
      '--context',
      cluster.context,
      '-n',
      platformNamespace,
      'port-forward',
      '--address',
      '127.0.0.1',
      `service/${service}`,
      `${local}:${remote}`
    ]);
    let code = await child.exited;
    if (isStopping()) return;

    log(`port-forward to ${service} exited with ${code}, reopening`);
    await sleep(restartDelayMs);
  }
};
