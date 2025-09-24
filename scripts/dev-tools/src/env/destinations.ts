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
    path: 'federation/backend/apps/federation-core-api'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/backend/apps/federation-core-worker'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/backend/apps/federation-core-broker'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/island/apps/island-core-api'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/island/apps/island-core-worker'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/island/apps/island-core-broker'
  },
  {
    type: 'enterprise',
    env: backendEnv,
    path: 'federation/island/apps/island-core-mcp'
  },

  ...['account', 'admin', 'auth', 'dashboard', 'team'].map(v => ({
    type: 'enterprise' as const,
    env: frontendEnv,
    path: `federation/frontend/apps/${v}`
  }))
];
