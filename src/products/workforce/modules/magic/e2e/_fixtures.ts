import { integrationService } from '@metorial-subspace/module-integration';
import { ID, type MagicMcpGroup } from '@metorial/db';
import { firstPage, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { accessTagService } from '@metorial/module-access';
import { consumerAccessService } from '@metorial/module-consumer-access';
import { consumerSurfaceService } from '@metorial/module-consumer-core';
import {
  magicMcpEndpointService,
  magicMcpGroupService,
  magicMcpServerService,
  magicMcpTokenService,
  providerTemplateService,
  resolveMagicMcpTargetByIdOrAlias,
  syncMagicMcpSubspaceSession
} from '../src';

type ServerInput = Parameters<typeof magicMcpServerService.createMagicMcpServer>[0]['input'];
type EndpointInput = Parameters<
  typeof magicMcpEndpointService.createMagicMcpEndpoint
>[0]['input'];
type TokenInput = Parameters<typeof magicMcpTokenService.createMagicMcpToken>[0]['input'];

export type MagicServer = Awaited<ReturnType<typeof createServer>>;
export type MagicEndpoint = Awaited<ReturnType<typeof createEndpoint>>;
export type Consumer = Awaited<ReturnType<typeof createConsumer>>;

export let createServer = async (fixture: OrganizationFixture, input: ServerInput = {}) =>
  await magicMcpServerService.createMagicMcpServer({
    organization: fixture.organization,
    performedBy: fixture.actor,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Magic Server'), ...input }
  });

export let archiveServer = async (fixture: OrganizationFixture, server: MagicServer) =>
  await magicMcpServerService.archiveMagicMcpServer({
    server,
    auditScope: fixture.auditScope
  });

export let createEndpoint = async (
  fixture: OrganizationFixture,
  servers: { id: string }[],
  input: EndpointInput = {}
) =>
  await magicMcpEndpointService.createMagicMcpEndpoint({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      name: uniqueId('Magic Endpoint'),
      servers: servers.map(server => ({ magicMcpServerId: server.id })),
      ...input
    }
  });

export let createGroup = async (
  fixture: OrganizationFixture,
  servers: { id: string }[] = []
) => {
  let group = await magicMcpGroupService.createMagicMcpGroup({
    organization: fixture.organization,
    performedBy: fixture.actor,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Magic Group') }
  });

  if (servers.length) {
    await magicMcpGroupService.addServersToGroup({
      group,
      serverIds: servers.map(server => server.id),
      auditScope: fixture.auditScope
    });
  }

  return group;
};

export let createToken = async (
  fixture: OrganizationFixture,
  input: TokenInput & { groups?: MagicMcpGroup[] } = {}
) => {
  let { groups, ...tokenInput } = input;

  return await magicMcpTokenService.createMagicMcpToken({
    instance: fixture.instance,
    groups,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Magic Token'), ...tokenInput }
  });
};

export let createIntegration = async (fixture: OrganizationFixture) =>
  await integrationService.createIntegration({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Magic Integration') }
  });

export let createProviderTemplate = async (
  fixture: OrganizationFixture,
  integrationId: string,
  name = uniqueId('Provider Template')
) =>
  await providerTemplateService.createProviderTemplate({
    organization: fixture.organization,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name, integrationId, metadata: { source: 'e2e' } }
  });

export let createConsumer = async (fixture: OrganizationFixture) => {
  let created = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Consumer Surface'), sessionExpiryTimeInSeconds: 3600 },
    type: 'portal'
  });

  let surface = await db.consumerSurface.findUniqueOrThrow({
    where: { oid: created.oid },
    include: { managedEveryoneGroup: true }
  });
  let everyone = surface.managedEveryoneGroup!;

  return { surface, everyone, accessTagOid: everyone.accessTagOid };
};

export let grantServerAccess = async (
  fixture: OrganizationFixture,
  consumer: Consumer,
  magicMcpServer: MagicServer
) =>
  await consumerAccessService.createConsumerAccess({
    organization: fixture.organization,
    consumerSurface: consumer.surface,
    consumerGroup: consumer.everyone,
    auditScope: fixture.auditScope,
    access: { type: 'magic_mcp_server', magicMcpServer }
  });

export let grantTemplateAccess = async (
  fixture: OrganizationFixture,
  consumer: Consumer,
  providerTemplate: Awaited<ReturnType<typeof createProviderTemplate>>
) =>
  await consumerAccessService.createConsumerAccess({
    organization: fixture.organization,
    consumerSurface: consumer.surface,
    consumerGroup: consumer.everyone,
    auditScope: fixture.auditScope,
    access: { type: 'provider_template', providerTemplate }
  });

export let createAccessTag = async (fixture: OrganizationFixture) =>
  await accessTagService.createAccessTag({ instance: fixture.instance });

export let grantAccessTag = async (
  fixture: OrganizationFixture,
  d: {
    accessTagOid: bigint;
    roles: readonly string[];
    target: {
      magicMcpServerOid?: bigint;
      magicMcpEndpointOid?: bigint;
      magicMcpTokenOid?: bigint;
    };
  }
) => {
  let policy = await db.accessTagPolicy.create({
    data: {
      id: await ID.generateId('accessTagPolicy'),
      name: uniqueId('e2e-magic-policy'),
      roles: [...d.roles],
      organizationOid: fixture.organization.oid
    }
  });

  await db.accessTagEntity.create({
    data: {
      accessTagOid: d.accessTagOid,
      accessTagPolicyOid: policy.oid,
      ...d.target
    }
  });
};

export let syncSession = async (
  targetId: string,
  ids: { subspaceSessionId?: string; backingSessionId?: string } = {}
) => {
  let target = await resolveMagicMcpTargetByIdOrAlias(targetId);

  return await syncMagicMcpSubspaceSession(
    target,
    ids.subspaceSessionId ?? uniqueId('ses'),
    ids.backingSessionId ?? uniqueId('ems')
  );
};

export let createReconciledSession = async (targetId: string) => {
  let session = await syncSession(targetId);

  return await db.magicMcpSession.update({
    where: { oid: session.oid },
    data: { isConsumerReconciled: true }
  });
};

export let isReconciled = async (session: { oid: bigint }) =>
  (await db.magicMcpSession.findUniqueOrThrow({ where: { oid: session.oid } }))
    .isConsumerReconciled;

export let ids = (items: { id: string }[]) => items.map(item => item.id);

export let sortedIds = (items: { id: string }[]) => ids(items).sort();

export let listServerIds = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof magicMcpServerService.listMagicMcpServers>[0],
    'instance'
  > = {}
) =>
  ids(
    await firstPage(
      await magicMcpServerService.listMagicMcpServers({
        instance: fixture.instance,
        ...filters
      })
    )
  );
