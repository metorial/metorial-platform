import { isIP } from 'node:net';

export type LocalClusterKind = 'orbstack' | 'docker-desktop' | 'kind' | 'k3d' | 'minikube';

export interface KubeConfig {
  contexts?: { name: string; context?: { cluster?: string } }[];
  clusters?: {
    name: string;
    cluster?: {
      server?: string;
      extensions?: { name?: string; extension?: { provider?: string } }[];
    };
  }[];
}

export interface KubeNode {
  name: string;
  labels: Record<string, string>;
}

export interface LocalCluster {
  kind: LocalClusterKind;
  context: string;
  // kind/k3d cluster name or minikube profile; used to load images and to check node names
  name: string;
  server: string;
}

let minikubeProvider = 'minikube.sigs.k8s.io';

let localHostnames = new Set([
  'localhost',
  'kubernetes.docker.internal',
  'host.docker.internal',
  'host.orb.internal'
]);

export class NotLocalClusterError extends Error {}

let isLoopback = (host: string) =>
  localHostnames.has(host) ||
  host === '0.0.0.0' ||
  host === '::1' ||
  host === '::' ||
  (isIP(host) === 4 && host.startsWith('127.'));

let isPrivateIPv4 = (host: string) => {
  if (isIP(host) !== 4) return false;
  let [a, b] = host.split('.').map(Number) as [number, number];

  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

let classify = (
  context: string,
  cluster: string,
  minikube: boolean
): { kind: LocalClusterKind; name: string } | undefined => {
  if (context === 'orbstack' && cluster === 'orbstack')
    return { kind: 'orbstack', name: context };

  if (
    (context === 'docker-desktop' || context === 'docker-for-desktop') &&
    cluster === 'docker-desktop'
  )
    return { kind: 'docker-desktop', name: context };

  let kind = /^kind-(.+)$/.exec(context);
  if (kind && cluster === context) return { kind: 'kind', name: kind[1]! };

  let k3d = /^k3d-(.+)$/.exec(context);
  if (k3d && cluster === context) return { kind: 'k3d', name: k3d[1]! };

  if ((minikube || context === 'minikube') && cluster === context)
    return { kind: 'minikube', name: context };

  return undefined;
};

// Only contexts that look like a local development cluster by name, cluster entry and API server
// address. Anything else is refused so the dev runtime never touches a shared cluster.
export let detectLocalCluster = (config: KubeConfig, context: string): LocalCluster => {
  let entry = config.contexts?.find(item => item.name === context);
  if (!entry)
    throw new NotLocalClusterError(`kube context ${JSON.stringify(context)} not found`);

  let clusterName = entry.context?.cluster ?? '';
  let cluster = config.clusters?.find(item => item.name === clusterName)?.cluster;
  if (!cluster?.server)
    throw new NotLocalClusterError(
      `kube context ${JSON.stringify(context)} has no cluster server`
    );

  let minikube = !!cluster.extensions?.some(
    item => item.extension?.provider === minikubeProvider
  );
  let match = classify(context, clusterName, minikube);
  if (!match)
    throw new NotLocalClusterError(
      `kube context ${JSON.stringify(context)} is not a kind, k3d, OrbStack, Docker Desktop or minikube context`
    );

  let host: string;
  try {
    host = new URL(cluster.server).hostname.replace(/^\[|\]$/g, '');
  } catch {
    throw new NotLocalClusterError(`invalid server ${JSON.stringify(cluster.server)}`);
  }

  let local = isLoopback(host) || (match.kind === 'minikube' && isPrivateIPv4(host));
  if (!local)
    throw new NotLocalClusterError(
      `kube context ${JSON.stringify(context)} points at ${host}, which is not a local address`
    );

  return { ...match, context, server: cluster.server };
};

let nodeMatches = (cluster: LocalCluster, node: KubeNode) => {
  switch (cluster.kind) {
    case 'orbstack':
      return node.name === 'orbstack';
    case 'docker-desktop':
      return node.name === 'docker-desktop' || node.name.startsWith('desktop-');
    case 'kind':
      return node.name.startsWith(`${cluster.name}-`);
    case 'k3d':
      return node.name.startsWith(`k3d-${cluster.name}-`);
    case 'minikube':
      return node.labels['minikube.k8s.io/name'] === cluster.name;
  }
};

// The kubeconfig alone can be fooled by a tunnel to a remote cluster on a loopback port; the
// nodes of a local cluster carry the distribution's own names.
export let verifyNodes = (cluster: LocalCluster, nodes: KubeNode[]) => {
  if (!nodes.length) throw new NotLocalClusterError(`${cluster.context} has no nodes`);

  let foreign = nodes.filter(node => !nodeMatches(cluster, node));
  if (foreign.length)
    throw new NotLocalClusterError(
      `${cluster.context} has nodes that don't belong to a local ${cluster.kind} cluster: ${foreign
        .map(node => node.name)
        .join(', ')}`
    );
};

export let hostAddress = (cluster: LocalCluster) => {
  switch (cluster.kind) {
    case 'k3d':
      return 'host.k3d.internal';
    case 'minikube':
      return 'host.minikube.internal';
    default:
      return 'host.docker.internal';
  }
};

export let sharesDockerImages = (cluster: LocalCluster) =>
  cluster.kind === 'orbstack' || cluster.kind === 'docker-desktop';

export let imageLoadCommand = (cluster: LocalCluster, image: string): string[] | undefined => {
  switch (cluster.kind) {
    case 'kind':
      return ['kind', 'load', 'docker-image', image, '--name', cluster.name];
    case 'k3d':
      return ['k3d', 'image', 'import', image, '--cluster', cluster.name];
    case 'minikube':
      return ['minikube', 'image', 'load', image, '--profile', cluster.name];
    default:
      return undefined;
  }
};
