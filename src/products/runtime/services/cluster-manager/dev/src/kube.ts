import { detectLocalCluster, verifyNodes, type KubeNode, type LocalCluster } from './cluster';
import { run } from './process';

export let platformNamespace = 'metorial-runtime-dev';

export let kubectl = (
  cluster: LocalCluster,
  args: string[],
  options?: Parameters<typeof run>[1]
) => run(['kubectl', '--context', cluster.context, ...args], options);

export let resolveCluster = async (): Promise<LocalCluster> => {
  let context =
    process.env.METORIAL_DEV_RUNTIME_CONTEXT?.trim() ||
    (await run(['kubectl', 'config', 'current-context'])).trim();
  let cluster = detectLocalCluster(
    JSON.parse(await run(['kubectl', 'config', 'view', '-o', 'json'])),
    context
  );

  let nodes = JSON.parse(await kubectl(cluster, ['get', 'nodes', '-o', 'json'])) as {
    items: { metadata: { name: string; labels?: Record<string, string> } }[];
  };
  verifyNodes(
    cluster,
    nodes.items.map((item): KubeNode => ({
      name: item.metadata.name,
      labels: item.metadata.labels ?? {}
    }))
  );

  return cluster;
};
