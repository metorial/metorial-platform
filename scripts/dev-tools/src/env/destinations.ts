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
  relayServiceEnv,
  signalServiceEnv,
  synthesisServiceEnv,
  shuttleServiceEnv,
  slatesHubEnv,
  slatesRegistryEnv,
  subspaceDbEnv,
  subspaceDevEnv,
  voyagerServiceEnv
} from './services';
import type { Destination } from './type';

export let destinations: Destination[] = [
  {
    type: 'oss',
    env: frontendEnv,
    path: 'src/metorial-frontend/apps/dashboard'
  },

  {
    type: 'oss',
    env: backendEnv,
    path: 'src/metorial/services/api'
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
    path: 'src/metorial-frontend/apps/marketplace'
  },

  ...['core-api', 'worker', 'global-router'].map(v => ({
    type: 'enterprise' as const,
    env: backendEnv,
    path: `src/metorial/services/${v}`
  })),

  {
    type: 'oss',
    env: subspaceDevEnv,
    path: 'src/subspace/apps/dev'
  },
  {
    type: 'oss',
    env: subspaceDbEnv,
    path: 'src/subspace/db'
  },

  {
    type: 'oss',
    env: signalServiceEnv,
    path: 'src/signal/service'
  },
  {
    type: 'oss',
    env: synthesisServiceEnv,
    path: 'src/synthesis/service'
  },
  {
    type: 'oss',
    env: cargoServiceEnv,
    path: 'src/cargo/service'
  },
  {
    type: 'oss',
    env: slatesHubEnv,
    path: 'src/slates/apps/hub'
  },
  {
    type: 'oss',
    env: slatesRegistryEnv,
    path: 'src/slates/apps/registry'
  },
  {
    type: 'oss',
    env: originServiceEnv,
    path: 'src/origin/apps/service'
  },
  {
    type: 'oss',
    env: originCodeBucketEnv,
    path: 'src/origin/apps/code-bucket'
  },
  {
    type: 'oss',
    env: shuttleServiceEnv,
    path: 'src/shuttle/service'
  },
  {
    type: 'oss',
    env: forgeServiceEnv,
    path: 'src/forge/service'
  },
  {
    type: 'oss',
    env: nebulaServiceEnv,
    path: 'src/nebula/service'
  },
  {
    type: 'oss',
    env: functionBayServiceEnv,
    path: 'src/function-bay/service'
  },
  {
    type: 'oss',
    env: voyagerServiceEnv,
    path: 'src/voyager/service'
  },
  {
    type: 'oss',
    env: relayServiceEnv,
    path: 'src/relay/service'
  },
  {
    type: 'oss',
    env: aresServiceEnv,
    path: 'src/ares/service'
  },
  {
    type: 'enterprise',
    env: horizonServiceEnv,
    path: 'src/horizon/apps/horizon'
  },

  ...['admin', 'dashboard', 'portal'].map(v => ({
    type: 'enterprise' as const,
    env: frontendEnv,
    path: `src/metorial-frontend/apps/${v}`
  }))
];
