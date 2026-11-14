import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectOk,
  expectServiceError,
  findTool,
  uniqueEmail,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { consumerProfileService } from '@metorial/module-consumer-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { consumerActivityService, consumerActorService } from '../src';
import { consumerView, createProfile, createSurface } from './_fixtures';

let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };

describe('module-consumer-entities consumer actors', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('provisions a separate default actor and identity per profile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let first = await createProfile(fixture, surface);
    let second = await createProfile(fixture, surface);

    let firstActor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: first
    });
    let secondActor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: second
    });

    expect(secondActor.id).not.toBe(firstActor.id);
    expect(secondActor.defaultIdentityId).not.toBe(firstActor.defaultIdentityId);
    expect(firstActor.instanceConsumerOid).not.toBe(secondActor.instanceConsumerOid);
    expect(firstActor.consumerOid).toBe(first.consumerOid);
  });

  it('rejects profiles of another instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let profile = await createProfile(fixture, await createSurface(fixture));
    let foreignProfile = await createProfile(other, await createSurface(other));

    await expectServiceError(
      consumerActorService.ensureDefaultConsumerActor({
        instance: fixture.instance,
        consumerProfile: foreignProfile
      }),
      'not_found'
    );
    await expectServiceError(
      consumerActorService.ensureDefaultConsumerActor({
        instance: other.instance,
        consumerProfile: profile
      }),
      'not_found'
    );

    expect(
      await db.consumerActor.count({
        where: {
          OR: [
            { consumerProfileOid: foreignProfile.oid, instanceOid: fixture.instance.oid },
            { consumerProfileOid: profile.oid, instanceOid: other.instance.oid }
          ]
        }
      })
    ).toBe(0);
  });

  it('rejects a deleted profile once it already has a default actor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: profile
    });

    await consumerProfileService.deleteConsumerProfile({
      consumerProfile: await consumerProfileService.getConsumerProfileById({
        consumerSurface: surface,
        consumerProfileId: profile.id
      }),
      auditScope: fixture.auditScope
    });

    await expectServiceError(
      consumerActorService.ensureDefaultConsumerActor({
        instance: fixture.instance,
        consumerProfile: profile
      }),
      'not_found'
    );
  });

  it('makes the oldest actor the default of an instance consumer with several profiles', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('entities-shared');
    let first = await createProfile(fixture, await createSurface(fixture), { email });
    let second = await createProfile(fixture, await createSurface(fixture), { email });
    expect(second.consumerOid).toBe(first.consumerOid);

    let firstActor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: first
    });
    let secondActor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: second
    });
    expect(secondActor.instanceConsumerOid).toBe(firstActor.instanceConsumerOid);
    let instanceConsumer = await db.instanceConsumer.findUniqueOrThrow({
      where: { oid: firstActor.instanceConsumerOid }
    });

    // The queued sync retries with exponential backoff under CI load, so the test runs it
    // directly; a failing sync then surfaces its own error instead of a test timeout.
    await eventually(
      async () => {
        await consumerActorService.syncInstanceConsumerActors({
          instanceConsumerId: instanceConsumer.id
        });

        let [oldest, newest] = await db.consumerActor.findMany({
          where: { oid: { in: [firstActor.oid, secondActor.oid] } },
          orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
        });
        expect(oldest!.defaultForInstanceConsumerOid).toBe(firstActor.instanceConsumerOid);
        expect(newest!.defaultForInstanceConsumerOid).toBeNull();
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );
  });

  it('renames the identity actors of a profile on reconcile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let name = uniqueId('Renamed Consumer');

    await eventually(async () => {
      let actor = await consumerActorService.reconcileConsumerProfileActors({
        instance: fixture.instance,
        consumerProfile: profile,
        name
      });
      expect(actor.consumerProfileOid).toBe(profile.oid);

      let identityActor = await subspaceDb.identityActor.findUniqueOrThrow({
        where: { id: actor.id }
      });
      expect(identityActor.name).toBe(name);
    }, workerTimeout);
  });
});

describe('module-consumer-entities consumer activity', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let sessionId: string;
  let sessionConnectionId: string;

  beforeAll(async () => {
    let provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    let session = await createProviderSession(org.clients.instance, [provider.providerId]);
    sessionId = session.id;

    let client = connectSession(session.id, org.keys.instanceSecret);
    let init = await client.initialize();
    if (init.status !== 200) throw new Error(`initialize responded ${init.status}`);
    let tools = await client.listTools();
    let echo = findTool(tools.result.tools, 'echo');
    await client.request('tools/call', { name: echo.name, arguments: { text: 'hello' } });

    sessionConnectionId = await eventually(async () => {
      let list = expectOk(
        await org.clients.instance.get('/session-connections', {
          query: { session_id: session.id }
        })
      );
      expect(list.items.length).toBeGreaterThan(0);
      return list.items[0].id as string;
    }, workerTimeout);
  }, 180_000);

  it('does not expose instance session traffic to a consumer', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let input = {
      instance: fixture.instance,
      consumerProfile: profile,
      accessTags: (await consumerView(profile)).accessTags
    };

    let connections = await consumerActivityService.listSessionConnections({
      ...input,
      pagination: { limit: 50 }
    });
    expect(connections.items).toEqual([]);
    expect(
      (await consumerActivityService.listAgents({ ...input, pagination: {} })).items
    ).toEqual([]);
    expect(
      (await consumerActivityService.listToolCalls({ ...input, pagination: {} })).items
    ).toEqual([]);
    expect(
      (await consumerActivityService.listIdentityCredentials({ ...input, pagination: {} }))
        .items
    ).toEqual([]);

    await expectServiceError(
      consumerActivityService.getSessionConnection({ ...input, sessionConnectionId }),
      'not_found'
    );
    await expectServiceError(
      consumerActivityService.listSessionConnections({ ...input, sessionId, pagination: {} }),
      'not_found'
    );
    await expectServiceError(
      consumerActivityService.listToolCalls({ ...input, sessionConnectionId, pagination: {} }),
      'not_found'
    );
    await expectServiceError(
      consumerActivityService.getAgent({ ...input, agentId: uniqueId('agt') }),
      'not_found'
    );
    await expectServiceError(
      consumerActivityService.getToolCall({ ...input, toolCallId: uniqueId('tcl') }),
      'not_found'
    );
    await expectServiceError(
      consumerActivityService.getIdentityCredential({
        ...input,
        identityCredentialId: uniqueId('icr')
      }),
      'not_found'
    );

    let connection = expectOk(
      await org.clients.instance.get(`/session-connections/${sessionConnectionId}`)
    );
    expect(connection.id).toBe(sessionConnectionId);
  });

  it('refuses to resolve activity for a profile of another instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let foreignProfile = await createProfile(other, await createSurface(other));

    await expectServiceError(
      consumerActivityService.listSessionConnections({
        instance: fixture.instance,
        consumerProfile: foreignProfile,
        accessTags: (await consumerView(foreignProfile)).accessTags,
        pagination: {}
      }),
      'not_found'
    );
    expect(
      await db.consumerActor.count({
        where: { consumerProfileOid: foreignProfile.oid, instanceOid: fixture.instance.oid }
      })
    ).toBe(0);
  });
});
