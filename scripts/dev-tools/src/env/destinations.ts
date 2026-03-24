import { backendEnv } from './backend';
import { frontendEnv } from './frontend';
import {
  horizonServiceEnv,
  originCodeBucketEnv,
  originServiceEnv,
  shuttleServiceEnv,
  signalServiceEnv,
  slatesHubEnv,
  subspaceDbEnv,
  subspaceDevEnv
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
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/backend/apps/core-api'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/backend/apps/worker'
  },

  {
    type: 'oss',
    env: signalServiceEnv,
    path: 'src/systems/signal/service'
  },
  {
    type: 'oss',
    env: slatesHubEnv,
    path: 'src/systems/slates/apps/hub'
  },
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
    type: 'enterprise',
    env: originServiceEnv,
    path: 'systems/origin/apps/service'
  },
  {
    type: 'enterprise',
    env: originCodeBucketEnv,
    path: 'systems/origin/apps/code-bucket'
  },
  {
    type: 'enterprise',
    env: shuttleServiceEnv,
    path: 'systems/shuttle/service'
  },
  {
    type: 'enterprise',
    env: horizonServiceEnv,
    path: 'systems/horizon/apps/horizon'
  },

  ...['admin', 'dashboard'].map(v => ({
    type: 'enterprise' as const,
    env: frontendEnv,
    path: `federation/frontend/apps/${v}`
  }))
];
