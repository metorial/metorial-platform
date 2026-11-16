export interface DevRuntimeKey {
  kid: string;
  publicKey: string;
}

export interface DevRuntimeKeys {
  functions: DevRuntimeKey;
  build: DevRuntimeKey;
}

export interface OverlayInput {
  base: string;
  keys: DevRuntimeKeys;
  objectStorageUrl: string;
}

let trustKeys = (keys: DevRuntimeKey[]) =>
  JSON.stringify({ keys: Object.fromEntries(keys.map(key => [key.kid, key.publicKey])) });

let configMap = (name: string, namespace: string, keysJson: string) => ({
  apiVersion: 'v1',
  kind: 'ConfigMap',
  metadata: { name, namespace },
  data: { 'keys.json': keysJson }
});

let deleted = (apiVersion: string, kind: string, name: string) => ({
  apiVersion,
  kind,
  metadata: { name, namespace: 'metorial-runtime-dev' },
  $patch: 'delete'
});

// deploy/dev-real with this checkout's signing keys and the host's object storage. Function pods
// verify invocation tokens against runtime-trust; the gateway verifies function and build grants
// against egress-trust.
export let renderOverlay = (input: OverlayInput) =>
  JSON.stringify(
    {
      apiVersion: 'kustomize.config.k8s.io/v1beta1',
      kind: 'Kustomization',
      resources: [input.base],
      patches: [
        configMap(
          'runtime-trust',
          'metorial-runtime-functions',
          trustKeys([input.keys.functions])
        ),
        configMap(
          'egress-trust',
          'metorial-runtime-dev',
          trustKeys([input.keys.functions, input.keys.build])
        ),
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: 'runtime-cluster-manager', namespace: 'metorial-runtime-dev' },
          spec: {
            template: {
              spec: {
                containers: [
                  {
                    name: 'cluster-manager',
                    env: [{ name: 'OBJECT_STORAGE_URL', value: input.objectStorageUrl }]
                  }
                ]
              }
            }
          }
        },
        deleted('apps/v1', 'Deployment', 'object-storage'),
        deleted('v1', 'Service', 'object-storage')
      ].map(patch => ({ patch: JSON.stringify(patch) }))
    },
    null,
    2
  ) + '\n';
