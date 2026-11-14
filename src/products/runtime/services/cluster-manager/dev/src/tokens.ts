import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LocalCluster } from './cluster';
import { kubectl, platformNamespace } from './kube';
import { isStopping, log, sleep } from './process';

let requestedDuration = '24h';
let minimumRefreshMs = 60_000;

// Must match the token files the control preset (devRuntime) points function-bay and forge at.
let callerTokens = [
  {
    file: 'functions-cluster-manager',
    serviceAccount: 'metorial-functions',
    audience: 'metorial-cluster-manager'
  },
  {
    file: 'functions-network-logs',
    serviceAccount: 'metorial-functions',
    audience: 'metorial-network-logs'
  },
  {
    file: 'build-cluster-manager',
    serviceAccount: 'metorial-build',
    audience: 'metorial-cluster-manager'
  }
];

export let tokenExpiry = (token: string) => {
  let payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
  if (typeof payload.exp !== 'number') throw new Error('token has no exp claim');

  return payload.exp * 1000;
};

// Refresh at half the remaining lifetime: the API server may shorten the requested duration.
export let refreshDelay = (expiresAt: number, now = Date.now()) =>
  Math.max(minimumRefreshMs, Math.floor((expiresAt - now) / 2));

let mint = async (
  cluster: LocalCluster,
  directory: string,
  item: (typeof callerTokens)[number]
) => {
  let token = (
    await kubectl(cluster, [
      '-n',
      platformNamespace,
      'create',
      'token',
      item.serviceAccount,
      '--audience',
      item.audience,
      '--duration',
      requestedDuration
    ])
  ).trim();

  let path = join(directory, item.file);
  writeFileSync(`${path}.tmp`, token + '\n', { mode: 0o600 });
  renameSync(`${path}.tmp`, path);

  return tokenExpiry(token);
};

export let mintTokens = async (cluster: LocalCluster, directory: string) => {
  let expiries = await Promise.all(callerTokens.map(item => mint(cluster, directory, item)));
  log(`minted caller tokens, valid until ${new Date(Math.min(...expiries)).toISOString()}`);

  return Math.min(...expiries);
};

export let refreshTokens = async (
  cluster: LocalCluster,
  directory: string,
  expiresAt: number
) => {
  while (!isStopping()) {
    await sleep(refreshDelay(expiresAt));

    try {
      expiresAt = await mintTokens(cluster, directory);
    } catch (error) {
      log(`token refresh failed, retrying in a minute: ${error}`);
      expiresAt = Date.now();
    }
  }
};
