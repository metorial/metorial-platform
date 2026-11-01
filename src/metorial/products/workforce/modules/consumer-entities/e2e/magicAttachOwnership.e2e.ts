import {
  createRemoteProvider,
  eventually,
  expectOk,
  expectServiceError,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import {
  db,
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import { ID, type ConsumerSurface, type MagicMcpServer } from '@metorial/db';
import { consumerMagicMcpWriteRoles } from '@metorial/module-access';
import { magicMcpServerService } from '@metorial/module-magic';
import { beforeAll, describe, expect, it } from 'vitest';
import { consumerActorService } from '../src';
import { createMagicServer, createProfile, createSurface } from './_fixtures';

let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };

describe('module-consumer-entities magic MCP attach ownership', () => {
  let org = useOrganization();
  let mcpServer = useMcpTestServer();

  let fixture: OrganizationFixture;
  let providerId: string;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    ({ providerId } = await createRemoteProvider(org.clients.instance, {
      url: mcpServer.url
    }));
  }, 180_000);

  let createConsumerActor = async (surface: ConsumerSurface) => {
    let profile = await createProfile(fixture, surface);
    let actor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: profile
    });
    await eventually(
      async () => await db.identityActor.findUniqueOrThrow({ where: { id: actor.id } }),
      workerTimeout
    );
    let subspaceActor = await subspaceDb.identityActor.findUniqueOrThrow({
      where: { id: actor.id }
    });

    return { profile, actor, subspaceActor };
  };

  let createConsumerServer = async (owner: Awaited<ReturnType<typeof createConsumerActor>>) =>
    await magicMcpServerService.createMagicMcpServer({
      organization: fixture.organization,
      performedBy: fixture.actor,
      instance: fixture.instance,
      context: fixture.context,
      auditScope: fixture.auditScope,
      input: {
        name: uniqueId('Consumer Server'),
        consumerOwner: {
          identityActorId: owner.actor.id,
          identityId: owner.actor.defaultIdentityId
        }
      }
    });

  let grantWrite = async (
    owner: Awaited<ReturnType<typeof createConsumerActor>>,
    server: MagicMcpServer
  ) => {
    let accessTagOid = owner.profile.personalConsumerGroup.accessTagOid;
    let policy = await db.accessTagPolicy.create({
      data: {
        id: await ID.generateId('accessTagPolicy'),
        name: uniqueId('e2e-attach-policy'),
        roles: [...consumerMagicMcpWriteRoles],
        organizationOid: fixture.organization.oid
      }
    });
    await db.accessTagEntity.create({
      data: { accessTagOid, accessTagPolicyOid: policy.oid, magicMcpServerOid: server.oid }
    });

    return { accessTagOid };
  };

  let createConfig = async (ownerActorOid?: bigint) => {
    let config = await eventually(
      async () =>
        expectOk(
          await org.clients.instance.post('/provider-configs', {
            provider_id: providerId,
            name: uniqueId('e2e-attach-config'),
            value: {}
          })
        ),
      workerTimeout
    );
    if (ownerActorOid) {
      await subspaceDb.providerConfig.update({
        where: { id: config.id },
        data: { ownerActorOid }
      });
    }

    return config.id as string;
  };

  let attach = (
    server: MagicMcpServer,
    accessTags: { accessTagOid: bigint },
    providerConfigId: string
  ) =>
    magicMcpServerService.createMagicMcpServerProvider({
      server,
      instance: fixture.instance,
      accessTags,
      input: { providerId, providerConfigId }
    });

  it('lets a consumer attach shared and own configs to their own server', async () => {
    let surface = await createSurface(fixture);
    let owner = await createConsumerActor(surface);
    let sharedServer = await createConsumerServer(owner);
    let ownServer = await createConsumerServer(owner);

    let shared = await attach(
      sharedServer,
      await grantWrite(owner, sharedServer),
      await createConfig()
    );
    expect(shared.magicMcpServerBacking.id).toBe(sharedServer.id);

    let own = await attach(
      ownServer,
      await grantWrite(owner, ownServer),
      await createConfig(owner.subspaceActor.oid)
    );
    expect(own.magicMcpServerBacking.id).toBe(ownServer.id);
  });

  it("rejects another consumer's config on a consumer's server", async () => {
    let surface = await createSurface(fixture);
    let owner = await createConsumerActor(surface);
    let other = await createConsumerActor(surface);
    let server = await createConsumerServer(owner);
    let accessTags = await grantWrite(owner, server);

    await expectServiceError(
      attach(server, accessTags, await createConfig(other.subspaceActor.oid)),
      'ownership_restricted'
    );
  });

  it("keeps a consumer's own config off a server shared by the organization", async () => {
    let surface = await createSurface(fixture);
    let consumer = await createConsumerActor(surface);
    let server = await createMagicServer(fixture);
    let accessTags = await grantWrite(consumer, server);

    let shared = await attach(server, accessTags, await createConfig());
    expect(shared.magicMcpServerBacking.id).toBe(server.id);

    await expectServiceError(
      attach(server, accessTags, await createConfig(consumer.subspaceActor.oid)),
      'ownership_restricted'
    );
  });
});
