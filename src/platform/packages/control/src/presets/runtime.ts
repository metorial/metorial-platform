import { createHash, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inherit, type EnvInput } from '../env';
import { dependency, type DependencyDefinition } from '../resources';

let ed25519Pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');

let runtimeModes = ['local', 'kubernetes'];

export let devRuntimePackage = '@metorial/runtime-dev';

export interface DevRuntimeKey {
  kid: string;
  seed: string;
  publicKey: string;
}

export interface DevRuntimeKeys {
  functions: DevRuntimeKey;
  build: DevRuntimeKey;
}

export let devRuntimeKeyFromSeed = (seed: string): DevRuntimeKey => {
  let privateKey = createPrivateKey({
    key: Buffer.concat([ed25519Pkcs8Prefix, Buffer.from(seed, 'base64url')]),
    format: 'der',
    type: 'pkcs8'
  });
  let publicKey = Buffer.from(
    createPublicKey(privateKey).export({ format: 'jwk' }).x!,
    'base64url'
  );

  return {
    kid: createHash('sha256').update(publicKey).digest('hex').slice(0, 16),
    seed,
    publicKey: publicKey.toString('base64url')
  };
};

let generateKey = () => devRuntimeKeyFromSeed(randomBytes(32).toString('base64url'));

let readOrCreateKeys = (path: string): DevRuntimeKeys => {
  try {
    writeFileSync(
      path,
      JSON.stringify({ functions: generateKey(), build: generateKey() }, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 }
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  return JSON.parse(readFileSync(path, 'utf8'));
};

let stateDirectory = (root: string) => join(root, '.control', 'runtime-dev');

// Returns undefined unless METORIAL_DEV_RUNTIME=kubernetes (process env or env.json), so
// manifests compile exactly as before without the opt-in.
export let devRuntime = (environment: Record<string, string | undefined> = process.env) => {
  let mode = environment.METORIAL_DEV_RUNTIME?.trim() || 'local';
  if (!runtimeModes.includes(mode))
    throw new Error(
      `METORIAL_DEV_RUNTIME must be one of ${runtimeModes.join(', ')}, got ${JSON.stringify(mode)}`
    );

  if (mode !== 'kubernetes') return undefined;

  let root = environment.CONTROL_PROJECT_ROOT;
  if (!root) throw new Error('METORIAL_DEV_RUNTIME=kubernetes needs CONTROL_PROJECT_ROOT');

  let state = stateDirectory(root);
  let tokens = join(state, 'tokens');
  mkdirSync(tokens, { recursive: true, mode: 0o700 });
  let keys = readOrCreateKeys(join(state, 'keys.json'));

  // noStart: function-bay and forge are stack members, the dev runtime is host-only.
  let clusterManagerUrl = (key: string): DependencyDefinition =>
    dependency(devRuntimePackage)
      .noStart()
      .env('control', key, 'http://127.0.0.1:{{BIND_PORT}}/rpc');

  return {
    state,
    keys,

    controllerEnv: (): EnvInput => ({
      RUNTIME_DEV_STATE_DIR: state,
      METORIAL_DEV_RUNTIME_CONTEXT: inherit(),
      METORIAL_DEV_RUNTIME_SKIP_BUILD: inherit()
    }),

    functionsDependencies: (): DependencyDefinition[] => [
      clusterManagerUrl('CLUSTER_MANAGER_URL').env(
        'networkLogs',
        'NETWORK_LOGS_URL',
        'http://127.0.0.1:{{BIND_PORT}}/rpc'
      )
    ],

    functionsEnv: (): EnvInput => ({
      DEFAULT_PROVIDER: 'knative',
      CLUSTER_MANAGER_TOKEN_FILE: join(tokens, 'functions-cluster-manager'),
      NETWORK_LOGS_TOKEN_FILE: join(tokens, 'functions-network-logs'),
      RUNTIME_SIGNING_KEY: keys.functions.seed,
      RUNTIME_SIGNING_KEY_ID: keys.functions.kid
    }),

    buildDependencies: (): DependencyDefinition[] => [
      clusterManagerUrl('CLUSTER_MANAGER_URL')
    ],

    buildEnv: (): EnvInput => ({
      DEFAULT_PROVIDER: 'kubernetes',
      CLUSTER_MANAGER_TOKEN_FILE: join(tokens, 'build-cluster-manager'),
      BUILD_SIGNING_KEY: keys.build.seed,
      BUILD_SIGNING_KEY_ID: keys.build.kid
    })
  };
};
