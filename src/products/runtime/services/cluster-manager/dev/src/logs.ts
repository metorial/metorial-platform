import type { LocalCluster } from './cluster';
import { kubectl, platformNamespace } from './kube';
import { isStopping, sleep, spawnInherited } from './process';

let pollMs = 5_000;
let initialTail = 100;
let restartDelayMs = 1_000;

let podNames = async (cluster: LocalCluster, app: string) =>
  (
    await kubectl(
      cluster,
      ['-n', platformNamespace, 'get', 'pods', '-l', `app=${app}`, '-o', 'name'],
      { quiet: true }
    ).catch(() => '')
  )
    .split('\n')
    .filter(Boolean)
    .sort()
    .join(',');

// kubectl logs -f with a selector only follows the pods that exist when it starts, so restart it
// whenever the pod set changes and continue from where the previous stream stopped.
export let followLogs = async (cluster: LocalCluster, app: string) => {
  let since: number | undefined;

  while (!isStopping()) {
    let pods = await podNames(cluster, app);
    if (!pods) {
      await sleep(pollMs);
      continue;
    }

    let child = spawnInherited([
      'kubectl',
      '--context',
      cluster.context,
      '-n',
      platformNamespace,
      'logs',
      '-f',
      '-l',
      `app=${app}`,
      '--all-containers',
      '--prefix',
      '--max-log-requests',
      '20',
      ...(since === undefined
        ? [`--tail=${initialTail}`]
        : [`--since=${Math.max(1, Math.ceil((Date.now() - since) / 1000))}s`])
    ]);

    let exited = false;
    void child.exited.then(() => (exited = true));
    while (!exited && !isStopping()) {
      await sleep(pollMs);
      if ((await podNames(cluster, app)) !== pods) child.kill();
    }

    await child.exited;
    since = Date.now();
    await sleep(restartDelayMs);
  }
};
