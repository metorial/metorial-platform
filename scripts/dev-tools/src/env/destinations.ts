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
    type: 'oss',
    env: frontendEnv,
    path: 'src/frontend/apps/code-workspace'
  },

  {
    type: 'oss',
    env: backendEnv,
    path: 'src/mcp-engine'
  },

  ...['code-bucket', 'listener', 'log', 'usage'].map(v => ({
    type: 'oss' as const,
    env: backendEnv,
    path: `src/services/${v}`
  })),

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
