import { backendEnv } from './backend';
import { frontendEnv } from './frontend';
import type { Destination } from './type';

export let destinations: Destination[] = [
  {
    type: 'oss',
    env: frontendEnv,
    path: 'src/frontend/apps/marketplace'
  },
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
    env: backendEnv,
    path: 'federation/backend/apps/core-api'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/backend/apps/worker'
  },

  ...['admin', 'dashboard'].map(v => ({
    type: 'enterprise' as const,
    env: frontendEnv,
    path: `federation/frontend/apps/${v}`
  }))
];
