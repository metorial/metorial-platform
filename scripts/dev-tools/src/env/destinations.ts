import { backendEnv } from './backend';
import { frontendEnv } from './frontend';
import type { Destination } from './types';

export let destinations: Destination[] = [
  {
    type: 'oss',
    env: frontendEnv,
    path: 'src/frontend/apps/marketplace'
  },

  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/backend/apps/api'
  },

  ...['account', 'admin', 'auth', 'dashboard', 'team'].map(v => ({
    type: 'enterprise' as const,
    env: frontendEnv,
    path: `federation/frontend/apps/${v}`
  }))
];
