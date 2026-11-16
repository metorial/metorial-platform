import { describe, expect, test } from 'bun:test';
import {
  detectLocalCluster,
  hostAddress,
  imageLoadCommand,
  NotLocalClusterError,
  sharesDockerImages,
  verifyNodes,
  type KubeConfig
} from './cluster';

let config = (
  context: string,
  server: string,
  options: { cluster?: string; minikube?: boolean } = {}
): KubeConfig => {
  let cluster = options.cluster ?? context;

  return {
    contexts: [{ name: context, context: { cluster } }],
    clusters: [
      {
        name: cluster,
        cluster: {
          server,
          ...(options.minikube
            ? {
                extensions: [
                  { name: 'cluster_info', extension: { provider: 'minikube.sigs.k8s.io' } }
                ]
              }
            : {})
        }
      }
    ]
  };
};

let detect = (context: string, server: string, options?: Parameters<typeof config>[2]) =>
  detectLocalCluster(config(context, server, options), context);

describe('detectLocalCluster', () => {
  test('accepts the local distributions', () => {
    expect(detect('orbstack', 'https://127.0.0.1:26443')).toMatchObject({
      kind: 'orbstack',
      name: 'orbstack'
    });
    expect(detect('docker-desktop', 'https://kubernetes.docker.internal:6443').kind).toBe(
      'docker-desktop'
    );
    expect(
      detect('docker-for-desktop', 'https://127.0.0.1:6443', { cluster: 'docker-desktop' })
        .kind
    ).toBe('docker-desktop');
    expect(detect('kind-dev', 'https://127.0.0.1:51234')).toMatchObject({
      kind: 'kind',
      name: 'dev'
    });
    expect(detect('k3d-metorial', 'https://0.0.0.0:6550')).toMatchObject({
      kind: 'k3d',
      name: 'metorial'
    });
    expect(detect('k3d-metorial', 'https://host.docker.internal:6550').kind).toBe('k3d');
    expect(detect('minikube', 'https://192.168.49.2:8443')).toMatchObject({
      kind: 'minikube',
      name: 'minikube'
    });
    expect(detect('runtime', 'https://127.0.0.1:52000', { minikube: true })).toMatchObject({
      kind: 'minikube',
      name: 'runtime'
    });
    expect(detect('kind-dev', 'https://[::1]:51234').kind).toBe('kind');
  });

  test('refuses contexts that are not a local distribution', () => {
    for (let context of [
      'production',
      'arn:aws:eks:us-east-1:1:cluster/kind-dev',
      'gke_kind-x'
    ])
      expect(() => detect(context, 'https://127.0.0.1:6443')).toThrow(NotLocalClusterError);
  });

  test('refuses local names that point at remote servers', () => {
    expect(() => detect('orbstack', 'https://k8s.example.com')).toThrow(/not a local address/);
    expect(() => detect('kind-dev', 'https://10.0.0.5:6443')).toThrow(/not a local address/);
    expect(() => detect('docker-desktop', 'https://34.12.0.1:443')).toThrow(
      /not a local address/
    );
    expect(() => detect('minikube', 'https://minikube.example.com:8443')).toThrow(
      /not a local address/
    );
  });

  test('refuses a local context name bound to a differently named cluster', () => {
    expect(() =>
      detect('orbstack', 'https://127.0.0.1:26443', { cluster: 'prod-eks' })
    ).toThrow(NotLocalClusterError);
    expect(() => detect('kind-dev', 'https://127.0.0.1:1', { cluster: 'kind-prod' })).toThrow(
      NotLocalClusterError
    );
  });

  test('refuses unknown contexts and missing servers', () => {
    expect(() =>
      detectLocalCluster(config('orbstack', 'https://127.0.0.1:1'), 'kind-x')
    ).toThrow(/not found/);
    expect(() =>
      detectLocalCluster(
        { contexts: [{ name: 'orbstack', context: { cluster: 'orbstack' } }], clusters: [] },
        'orbstack'
      )
    ).toThrow(/no cluster server/);
  });
});

describe('verifyNodes', () => {
  let node = (name: string, labels: Record<string, string> = {}) => ({ name, labels });

  test('accepts nodes named by the distribution', () => {
    verifyNodes(detect('orbstack', 'https://127.0.0.1:26443'), [node('orbstack')]);
    verifyNodes(detect('kind-dev', 'https://127.0.0.1:1'), [
      node('dev-control-plane'),
      node('dev-worker')
    ]);
    verifyNodes(detect('k3d-x', 'https://0.0.0.0:1'), [node('k3d-x-server-0')]);
    verifyNodes(detect('docker-desktop', 'https://127.0.0.1:6443'), [
      node('desktop-control-plane')
    ]);
    verifyNodes(detect('minikube', 'https://192.168.49.2:8443'), [
      node('minikube', { 'minikube.k8s.io/name': 'minikube' })
    ]);
  });

  test('refuses foreign or missing nodes (a tunnel to another cluster)', () => {
    expect(() =>
      verifyNodes(detect('orbstack', 'https://127.0.0.1:26443'), [
        node('ip-10-0-1-12.ec2.internal')
      ])
    ).toThrow(NotLocalClusterError);
    expect(() =>
      verifyNodes(detect('kind-dev', 'https://127.0.0.1:1'), [node('prod-control-plane')])
    ).toThrow(NotLocalClusterError);
    expect(() => verifyNodes(detect('orbstack', 'https://127.0.0.1:26443'), [])).toThrow(
      /no nodes/
    );
  });
});

describe('cluster specifics', () => {
  test('host address and image loading per distribution', () => {
    let orbstack = detect('orbstack', 'https://127.0.0.1:26443');
    let kind = detect('kind-dev', 'https://127.0.0.1:1');
    let k3d = detect('k3d-x', 'https://0.0.0.0:1');
    let minikube = detect('minikube', 'https://192.168.49.2:8443');

    expect(hostAddress(orbstack)).toBe('host.docker.internal');
    expect(hostAddress(k3d)).toBe('host.k3d.internal');
    expect(hostAddress(minikube)).toBe('host.minikube.internal');

    expect(sharesDockerImages(orbstack)).toBe(true);
    expect(imageLoadCommand(orbstack, 'dev.local/a:dev')).toBeUndefined();
    expect(imageLoadCommand(kind, 'dev.local/a:dev')).toEqual([
      'kind',
      'load',
      'docker-image',
      'dev.local/a:dev',
      '--name',
      'dev'
    ]);
    expect(imageLoadCommand(k3d, 'dev.local/a:dev')).toEqual([
      'k3d',
      'image',
      'import',
      'dev.local/a:dev',
      '--cluster',
      'x'
    ]);
    expect(imageLoadCommand(minikube, 'dev.local/a:dev')?.[0]).toBe('minikube');
  });
});
