import {
  authClients,
  eventually,
  metorialEndpoints,
  rest,
  type BootstrappedOrganization,
  type RestClient
} from '@metorial/e2e';
import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { AiGateway } from '@metorial/module-ai-gateway';
import { createServer } from 'node:http';
import { expect } from 'vitest';
import { catalogArchive, catalogFingerprint, catalogFingerprintFile } from './_catalog';

export let catalogPort = 52199;

export type CredentialName =
  | 'none'
  | 'session'
  | 'management'
  | 'instance'
  | 'otherSession'
  | 'otherManagement'
  | 'otherInstance';

export let gatewayPath = (org: BootstrappedOrganization, name: string, path: string) => {
  let suffix = `/ai-gateway${path}`;

  if (name === 'session' || name === 'otherSession') {
    return `/dashboard/instances/${org.ids.instanceId}${suffix}`;
  }
  if (name === 'management' || name === 'otherManagement') {
    return `/instances/${org.ids.instanceId}${suffix}`;
  }
  return suffix;
};

export let crossTenantClients = (
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization
): Record<CredentialName, RestClient> =>
  authClients(org, {
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance
  });

export let ids = (items: { id: string }[]) => items.map(item => item.id);

export let aiGatewayRpc = () =>
  rpc<AiGateway>(`${e2eEndpoint('@mtsrc/ai-gateway-service', 'api')}/metorial-ai-gateway`);

let catalogServer: Promise<void> | undefined;

let serveCatalog = () =>
  (catalogServer ??= new Promise<void>((resolve, reject) => {
    let server = createServer((request, response) => {
      if (request.url === '/fingerprint.json') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(catalogFingerprintFile);
      } else if (request.url === '/catalog.json.gz') {
        response.writeHead(200, { 'content-type': 'application/gzip' });
        response.end(catalogArchive);
      } else {
        response.writeHead(404);
        response.end();
      }
    });

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') resolve();
      else reject(error);
    });
    server.listen(catalogPort, '127.0.0.1', () => {
      server.unref();
      resolve();
    });
  }));

export let ensureCatalog = async () => {
  await serveCatalog();

  let gateway = aiGatewayRpc();
  let isSynced = async () =>
    (await gateway.catalog.getSyncStatus({})).fingerprint === catalogFingerprint;

  if (await isSynced()) return;

  await gateway.catalog.requestSync({});
  await eventually(async () => expect(await isSynced()).toBe(true), {
    timeoutMs: 90_000,
    intervalMs: 1_000
  });
};
