import { backendEnv } from './backend';
import { frontendEnv } from './frontend';
import {
  aresServiceEnv,
  cargoServiceEnv,
  forgeServiceEnv,
  functionBayServiceEnv,
  horizonServiceEnv,
  nebulaServiceEnv,
  originCodeBucketEnv,
  originServiceEnv,
  signalServiceEnv,
  synthesisServiceEnv,
  shuttleServiceEnv,
  slatesHubEnv,
  slatesRegistryEnv,
  subspaceDbEnv,
  subspaceDevEnv,
  subspaceEnclaveEnv
} from './services';
import type { Destination } from './type';

export let destinations: Destination[] = [
  {
    type: 'oss',
    env: frontendEnv,
    path: 'src/frontend/apps/dashboard'
  },

  {
    type: 'oss',
    env: backendEnv,
    path: 'src/backend/apps/api'
  },

  // {
  //   type: 'oss',
  //   env: backendEnv,
  //   path: 'src/services/sso'
  // },

  // ...['code-bucket', 'listener', 'log', 'usage'].map(v => ({
  //   type: 'oss' as const,
  //   env: backendEnv,
  //   path: `src/services/${v}`
  // })),

  {
    type: 'enterprise',
    env: frontendEnv,
    path: 'federation/frontend/apps/marketplace'
  },

  ...['core-api', 'worker', 'global-router'].map(v => ({
    type: 'enterprise' as const,
    env: backendEnv,
    path: `federation/backend/apps/${v}`
  })),

  {
    type: 'oss',
    env: subspaceDevEnv,
    path: 'src/systems/subspace/apps/dev'
  },
  {
    type: 'oss',
    env: subspaceDbEnv,
    path: 'src/systems/subspace/db'
  },
  {
    type: 'oss',
    env: subspaceEnclaveEnv,
    path: 'src/systems/subspace/modules/enclave'
  },

  {
    type: 'oss',
    env: signalServiceEnv,
    path: 'src/systems/signal/service'
  },
  {
    type: 'oss',
    env: synthesisServiceEnv,
    path: 'src/systems/synthesis/service'
  },
  {
    type: 'oss',
    env: cargoServiceEnv,
    path: 'src/systems/cargo/service'
  },
  {
    type: 'oss',
    env: slatesHubEnv,
    path: 'src/systems/slates/apps/hub'
  },
  {
    type: 'oss',
    env: slatesRegistryEnv,
    path: 'src/systems/slates/apps/registry'
  },
  {
    type: 'oss',
    env: originServiceEnv,
    path: 'src/systems/origin/apps/service'
  },
  {
    type: 'oss',
    env: originCodeBucketEnv,
    path: 'src/systems/origin/apps/code-bucket'
  },
  {
    type: 'oss',
    env: shuttleServiceEnv,
    path: 'src/systems/shuttle/service'
  },
  {
    type: 'oss',
    env: forgeServiceEnv,
    path: 'src/systems/forge/service'
  },
  {
    type: 'oss',
    env: nebulaServiceEnv,
    path: 'src/systems/nebula/service'
  },
  {
    type: 'oss',
    env: functionBayServiceEnv,
    path: 'src/systems/function-bay/service'
  },
  {
    type: 'oss',
    env: aresServiceEnv,
    path: 'src/systems/ares/service'
  },
  {
    type: 'enterprise',
    env: horizonServiceEnv,
    path: 'systems/horizon/apps/horizon'
  },

  ...['admin', 'dashboard', 'portal'].map(v => ({
    type: 'enterprise' as const,
    env: frontendEnv,
    path: `federation/frontend/apps/${v}`
  }))
];
