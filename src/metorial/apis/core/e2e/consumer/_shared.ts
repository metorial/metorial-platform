import {
  API_VERSIONS,
  authClients,
  eventually,
  expectOk,
  metorialEndpoints,
  rest,
  testContext,
  uniqueEmail,
  uniqueId,
  useFixture,
  type BootstrappedOrganization,
  type RestClient
} from '@metorial/e2e';
import { db, subspaceDb } from '@metorial/e2e/db';
import { consumerAuthService } from '@metorial/module-consumer-core';

export type CredentialName =
  | 'none'
  | 'session'
  | 'management'
  | 'instance'
  | 'otherSession'
  | 'otherManagement'
  | 'otherInstance';

export interface Consumer {
  profile: any;
  sessionId: string;
  token: string;
  publishableKey: string;
  client: RestClient;
  magnetar: RestClient;
}

export let instancePathFor = (org: BootstrappedOrganization, name: string, path: string) => {
  if (name === 'session' || name === 'otherSession') {
    return `/dashboard/instances/${org.ids.instanceId}${path}`;
  }
  if (name === 'management' || name === 'otherManagement') {
    return `/instances/${org.ids.instanceId}${path}`;
  }
  return path;
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

export let createPortal = async (
  org: BootstrappedOrganization,
  body: Record<string, unknown> = {}
) =>
  expectOk(
    await org.clients.instance.post('/portals', { name: uniqueId('E2E Portal'), ...body })
  );

export let createConsumerProfile = async (
  org: BootstrappedOrganization,
  portalId: string,
  input: { email?: string; name?: string } = {}
) =>
  expectOk(
    await org.clients.instance.post(`/portals/${portalId}/consumer-profile`, {
      email: input.email ?? uniqueEmail('consumer'),
      name: input.name ?? uniqueId('E2E Consumer')
    })
  );

export let createConsumerGroup = async (
  org: BootstrappedOrganization,
  portalId: string,
  body: Record<string, unknown> = {}
) =>
  expectOk(
    await org.clients.instance.post(`/portals/${portalId}/consumer-groups`, {
      name: uniqueId('E2E Group'),
      ...body
    })
  );

export let createMagicServer = async (org: BootstrappedOrganization) =>
  expectOk(
    await org.clients.instance.post('/magic-mcp-servers', {
      name: uniqueId('E2E Magic Server')
    })
  );

export let createListing = async (
  org: BootstrappedOrganization,
  portalId: string,
  magicMcpServerId: string,
  body: Record<string, unknown> = {}
) =>
  expectOk(
    await org.clients.instance.post(`/portals/${portalId}/listings`, {
      name: uniqueId('E2E Listing'),
      access: { type: 'magic_mcp_server', magic_mcp_server_id: magicMcpServerId },
      ...body
    })
  );

export let loadPortalSurface = async (portalId: string) => {
  let portal = await db.portal.findUniqueOrThrow({
    where: { id: portalId },
    include: {
      surface: { include: { publishableApiKey: { include: { secrets: true } } } }
    }
  });

  let secret = portal.surface.publishableApiKey.secrets
    .filter(secret => !secret.rolledAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!secret) throw new Error(`Portal ${portalId} has no publishable key secret`);

  return { surface: portal.surface, publishableKey: secret.secret };
};

export let consumerClient = (auth: { publishableKey: string; token: string }) =>
  rest(metorialEndpoints().api, { apiKey: auth.publishableKey, consumerToken: auth.token });

export let startConsumerSession = async (
  portalId: string,
  profile: { id: string }
): Promise<Consumer> => {
  let { surface, publishableKey } = await loadPortalSurface(portalId);
  let consumerProfile = await db.consumerProfile.findUniqueOrThrow({
    where: { id: profile.id }
  });

  let session = await consumerAuthService.createConsumerSession({
    consumerSurface: surface,
    consumerProfile,
    context: testContext()
  });
  let token = await consumerAuthService.getConsumerToken({ session, surface });

  let client = consumerClient({ publishableKey, token });
  return {
    profile,
    sessionId: session.id,
    token,
    publishableKey,
    client,
    magnetar: client.with({ version: API_VERSIONS.magnetar })
  };
};

export let createConsumer = async (org: BootstrappedOrganization, portalId: string) =>
  await startConsumerSession(portalId, await createConsumerProfile(org, portalId));

export let useConsumerPortal = (org: BootstrappedOrganization) =>
  useFixture(async () => {
    let portal = await createPortal(org);
    let consumer = await createConsumer(org, portal.id);
    return { portal, consumer };
  });

export let waitForSubspaceTenant = async (org: BootstrappedOrganization) => {
  let project = await db.project.findUniqueOrThrow({ where: { id: org.ids.projectId } });

  await eventually(
    async () =>
      await subspaceDb.tenant.findFirstOrThrow({ where: { projectOid: project.oid } }),
    { timeoutMs: 60_000, intervalMs: 500 }
  );
};
