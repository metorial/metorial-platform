import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { hostAddress, imageLoadCommand, type LocalCluster } from './cluster';
import { kubectl, platformNamespace } from './kube';
import { renderOverlay, type DevRuntimeKeys } from './overlay';
import { log, run } from './process';

let devDirectory = join(import.meta.dir, '..');
let deployDirectory = join(devDirectory, '..', 'deploy');
let ossRoot = join(devDirectory, '..', '..', '..', '..', '..', '..');
let runtimeDirectory = 'src/products/runtime/services';

let images = [
  {
    image: 'dev.local/runtime-cluster-manager:dev',
    dockerfile: `${runtimeDirectory}/cluster-manager/service/Dockerfile`,
    deployment: 'runtime-cluster-manager'
  },
  {
    image: 'dev.local/runtime-egress-gateway:dev',
    dockerfile: `${runtimeDirectory}/networking/service/gateway.Dockerfile`,
    deployment: 'runtime-egress-gateway'
  },
  {
    image: 'dev.local/runtime-network-logs:dev',
    dockerfile: `${runtimeDirectory}/networking/service/logstore.Dockerfile`,
    deployment: 'runtime-network-logs'
  },
  {
    image: 'dev.local/runtime-function-nodejs-24:dev',
    dockerfile: `${runtimeDirectory}/cluster-manager/images/function-node24/Dockerfile`
  },
  {
    image: 'dev.local/runtime-build-ubuntu:dev',
    dockerfile: `${runtimeDirectory}/cluster-manager/images/build-ubuntu/Dockerfile`
  }
];

let rolloutDeployments = [
  'network-logs-postgres',
  'runtime-network-logs',
  'runtime-egress-gateway',
  'runtime-cluster-manager'
];

let knativeDeployments = [
  ['knative-serving', 'controller'],
  ['knative-serving', 'activator'],
  ['knative-serving', 'autoscaler'],
  ['knative-serving', 'webhook'],
  ['knative-serving', 'net-kourier-controller'],
  ['kourier-system', '3scale-kourier-gateway']
] as const;

// An existing Knative install is left untouched, its configuration may be shared.
export let ensureKnative = async (cluster: LocalCluster) => {
  let missing: string[] = [];
  for (let [namespace, name] of knativeDeployments) {
    let exists = await kubectl(cluster, ['-n', namespace, 'get', 'deployment', name], {
      quiet: true
    }).then(
      () => true,
      () => false
    );
    if (!exists) missing.push(`${namespace}/${name}`);
  }

  if (!missing.length) return log('Knative Serving is installed');

  log(`installing Knative Serving (missing ${missing.join(', ')})`);
  await run([join(deployDirectory, 'knative', 'install.sh')], {
    env: { KUBE_CONTEXT: cluster.context }
  });
};

let imageId = (image: string) =>
  run(['docker', 'image', 'inspect', '-f', '{{.Id}}', image], { quiet: true }).then(
    id => id.trim(),
    () => undefined
  );

// Returns the deployments whose image changed, so they can be restarted after the apply.
export let buildImages = async (cluster: LocalCluster, skipBuild: boolean) => {
  let changed: string[] = [];

  for (let item of images) {
    let before = await imageId(item.image);

    if (!skipBuild || !before) {
      let started = Date.now();
      log(`building ${item.image}`);
      await run([
        'docker',
        'build',
        '-q',
        '-f',
        join(ossRoot, item.dockerfile),
        '-t',
        item.image,
        ossRoot
      ]);
      log(`built ${item.image} in ${Math.round((Date.now() - started) / 1000)}s`);
    }

    let load = imageLoadCommand(cluster, item.image);
    if (load) {
      log(`loading ${item.image} into ${cluster.context}`);
      await run(load);
    }

    if (item.deployment && before !== (await imageId(item.image)))
      changed.push(item.deployment);
  }

  return changed;
};

export let applyStack = async (
  cluster: LocalCluster,
  d: { state: string; objectStoragePort: string; restart: string[] }
) => {
  let overlay = join(d.state, 'overlay');
  mkdirSync(overlay, { recursive: true });

  let keys = JSON.parse(readFileSync(join(d.state, 'keys.json'), 'utf8')) as DevRuntimeKeys;
  let objectStorageUrl = `http://${hostAddress(cluster)}:${d.objectStoragePort}`;
  writeFileSync(
    join(overlay, 'kustomization.yaml'),
    renderOverlay({
      base: relative(overlay, join(deployDirectory, 'dev-real')),
      keys,
      objectStorageUrl
    })
  );

  log(`applying the dev stack (object storage ${objectStorageUrl})`);
  await kubectl(cluster, ['apply', '-k', overlay]);
  await kubectl(cluster, [
    '-n',
    platformNamespace,
    'delete',
    'deployment,service',
    'object-storage',
    '--ignore-not-found'
  ]);

  for (let deployment of d.restart) {
    log(`restarting ${deployment} for its new image`);
    await kubectl(cluster, [
      '-n',
      platformNamespace,
      'rollout',
      'restart',
      `deployment/${deployment}`
    ]);
  }

  for (let deployment of rolloutDeployments)
    await kubectl(cluster, [
      '-n',
      platformNamespace,
      'rollout',
      'status',
      `deployment/${deployment}`,
      '--timeout=300s'
    ]);
  log('dev stack is ready');
};
