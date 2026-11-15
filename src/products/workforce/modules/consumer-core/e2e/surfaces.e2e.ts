import {
  eventually,
  expectServiceError,
  firstPage,
  testContext,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerAuthService, consumerSurfaceService } from '../src';
import { captureFabric, createConsumerProfile, createConsumerSurface } from './_fixtures';

describe('module-consumer-core surfaces', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a portal surface with its publishable key, auth tenant and everyone group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = captureFabric('consumer.surface.created:after');

    let surface = await createConsumerSurface(fixture, {
      emailWhitelist: ['*@Example.COM', 'Ada@E2E.Metorial.Test', 'example.com']
    });
    created.stop();

    expect(surface).toMatchObject({
      type: 'portal',
      status: 'active',
      isInternal: false,
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      emailWhitelist: ['ada@e2e.metorial.test', 'example.com']
    });
    expect(created.events.map(event => event.consumerSurface.id)).toEqual([surface.id]);

    let apiKey = await db.apiKey.findUniqueOrThrow({
      where: { oid: surface.publishableApiKeyOid },
      include: { machineAccess: true }
    });
    expect(apiKey).toMatchObject({
      status: 'active',
      type: 'instance_access_token_publishable'
    });
    expect(apiKey.machineAccess.status).toBe('active');

    let tenant = await db.consumerAuthTenant.findUniqueOrThrow({
      where: { oid: surface.consumerAuthTenantOid! }
    });
    expect(tenant.organizationOid).toBe(fixture.organization.oid);

    let groups = await db.consumerGroup.findMany({ where: { surfaceOid: surface.oid } });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      name: 'Everyone',
      isDefault: true,
      isDefaultEveryoneGroup: true,
      isManaged: true,
      type: 'default'
    });
    expect(
      (await db.consumerSurface.findUniqueOrThrow({ where: { oid: surface.oid } }))
        .managedEveryoneGroupOid
    ).toBe(groups[0]!.oid);
  });

  it('creates an internal organization members surface once per identifier', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let identifier = uniqueId('internal');

    let first = await consumerSurfaceService.ensureInternalConsumerSurface({
      instance: fixture.instance,
      identifier,
      name: 'Internal',
      type: 'organization_members'
    });
    let second = await consumerSurfaceService.ensureInternalConsumerSurface({
      instance: fixture.instance,
      identifier,
      name: 'Internal again',
      type: 'organization_members'
    });

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      type: 'organization_members',
      isInternal: true,
      internalSurfaceUniqueIdentifier: identifier,
      managedEveryoneGroupOid: null
    });
    expect(await db.consumerGroup.count({ where: { surfaceOid: first.oid } })).toBe(0);
    expect(
      await db.consumerSurface.count({
        where: {
          instanceOid: fixture.instance.oid,
          internalSurfaceUniqueIdentifier: identifier
        }
      })
    ).toBe(1);
  });

  it('rejects invalid email whitelist entries and releases the publishable key it created', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Invalid Surface');

    await expectServiceError(
      createConsumerSurface(fixture, { name, emailWhitelist: ['not a domain'] }),
      'bad_request'
    );

    expect(await db.consumerSurface.count({ where: { name } })).toBe(0);
    let keys = await db.apiKey.findMany({
      where: { name: `Publishable API Key for Consumer Surface ${name}` }
    });
    expect(keys.map(key => key.status)).toEqual(['deleted']);

    let surface = await createConsumerSurface(fixture);
    await expectServiceError(
      consumerSurfaceService.updateConsumerSurface({
        consumerSurface: surface,
        auditScope: fixture.auditScope,
        input: { emailWhitelist: ['@@'] }
      }),
      'bad_request'
    );
    expect(
      (await db.consumerSurface.findUniqueOrThrow({ where: { oid: surface.oid } }))
        .emailWhitelist
    ).toEqual([]);
  });

  it('updates a surface and fires the updated event with the previous state', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let updated = captureFabric('consumer.surface.updated:after');

    let result = await consumerSurfaceService.updateConsumerSurface({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: {
        name: `${surface.name} renamed`,
        description: 'Updated by e2e',
        sessionExpiryTimeInSeconds: 7200
      }
    });
    updated.stop();

    expect(result).toMatchObject({
      name: `${surface.name} renamed`,
      description: 'Updated by e2e',
      sessionExpiryTimeInSeconds: 7200,
      emailWhitelist: []
    });
    expect(result.skillConfiguration).toBeTruthy();
    expect(updated.events).toHaveLength(1);
    expect(updated.events[0]!.previousConsumerSurface.name).toBe(surface.name);
    expect(updated.events[0]!.consumerSurface.sessionExpiryTimeInSeconds).toBe(7200);
  });

  it('archives a surface, rejecting its tokens and deactivating its key and sessions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let session = await consumerAuthService.createConsumerSession({
      consumerSurface: surface,
      consumerProfile: profile,
      context: testContext()
    });
    let token = await consumerAuthService.getConsumerSessionToken({ session, surface });
    let archivedEvents = captureFabric('consumer.surface.archived:after');

    let archived = await consumerSurfaceService.archiveConsumerSurface({
      consumerSurface: surface,
      auditScope: fixture.auditScope
    });
    archivedEvents.stop();

    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(archivedEvents.events.map(event => event.consumerSurface.id)).toEqual([surface.id]);

    await expectServiceError(
      consumerAuthService.authenticateWithConsumerSessionToken({ token, surface: archived }),
      'unauthorized'
    );

    await eventually(async () => {
      let stored = await db.consumerSession.findUniqueOrThrow({ where: { oid: session.oid } });
      expect(stored.loggedOutAt).toBeInstanceOf(Date);

      let apiKey = await db.apiKey.findUniqueOrThrow({
        where: { oid: surface.publishableApiKeyOid },
        include: { machineAccess: true }
      });
      expect(apiKey.status).toBe('deleted');
      expect(apiKey.machineAccess.status).toBe('deleted');
    });

    for (let call of [
      () =>
        consumerSurfaceService.archiveConsumerSurface({
          consumerSurface: archived,
          auditScope: fixture.auditScope
        }),
      () => consumerSurfaceService.deleteConsumerSurface({ consumerSurface: archived }),
      () =>
        consumerSurfaceService.updateConsumerSurface({
          consumerSurface: archived,
          auditScope: fixture.auditScope,
          input: { name: uniqueId('Too Late') }
        })
    ]) {
      await expectServiceError(call(), 'precondition_failed');
    }
  });

  it('deletes an active surface and deactivates its publishable key', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);

    let deleted = await consumerSurfaceService.deleteConsumerSurface({
      consumerSurface: surface
    });
    expect(deleted).toMatchObject({ status: 'deleted', archivedAt: null });
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    await eventually(async () => {
      let apiKey = await db.apiKey.findUniqueOrThrow({
        where: { oid: surface.publishableApiKeyOid }
      });
      expect(apiKey.status).toBe('deleted');
    });
  });

  it('does not resolve or list surfaces of another instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createConsumerSurface(fixture);

    await expectServiceError(
      consumerSurfaceService.getConsumerSurfaceById({
        instance: other.instance,
        consumerSurfaceId: surface.id
      }),
      'not_found'
    );

    let otherSurfaces = await firstPage(
      await consumerSurfaceService.listConsumerSurfaces({ instance: other.instance })
    );
    expect(otherSurfaces.map(item => item.id)).not.toContain(surface.id);

    let ownSurfaces = await firstPage(
      await consumerSurfaceService.listConsumerSurfaces({ instance: fixture.instance })
    );
    expect(ownSurfaces.map(item => item.id)).toContain(surface.id);
  });
});
