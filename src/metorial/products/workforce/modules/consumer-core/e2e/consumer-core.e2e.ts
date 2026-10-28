import { firstPage, rejectionOf, uniqueEmail, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  consumerGroupService,
  consumerProfileService,
  consumerService,
  consumerSurfaceService
} from '../src';

let createSurface = async (fixture: OrganizationFixture, name = uniqueId('Surface')) =>
  await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name, sessionExpiryTimeInSeconds: 3600 }
  });

describe('module-consumer-core', () => {
  let org = useOrganization();

  it('creates, gets, lists, updates and archives a consumer surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Surface');

    let surface = await createSurface(fixture, name);
    expect(surface.name).toBe(name);
    expect(surface.type).toBe('portal');
    expect(surface.status).toBe('active');
    expect(surface.isInternal).toBe(false);

    let everyone = await db.consumerGroup.findFirstOrThrow({
      where: { surfaceOid: surface.oid, isDefaultEveryoneGroup: true }
    });
    expect(everyone.isDefault).toBe(true);
    expect(everyone.isManaged).toBe(true);

    let fetched = await consumerSurfaceService.getConsumerSurfaceById({
      instance: fixture.instance,
      consumerSurfaceId: surface.id
    });
    expect(fetched.id).toBe(surface.id);
    expect(fetched.managedEveryoneGroup?.id).toBe(everyone.id);

    let listed = await firstPage(
      await consumerSurfaceService.listConsumerSurfaces({ instance: fixture.instance })
    );
    expect(listed.map(item => item.id)).toContain(surface.id);

    let renamed = uniqueId('Renamed Surface');
    let updated = await consumerSurfaceService.updateConsumerSurface({
      consumerSurface: fetched,
      auditScope: fixture.auditScope,
      input: { name: renamed, emailWhitelist: ['E2E.Metorial.Test'] }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.emailWhitelist).toEqual(['e2e.metorial.test']);

    let archived = await consumerSurfaceService.archiveConsumerSurface({
      consumerSurface: updated,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');

    let error = await rejectionOf(
      consumerSurfaceService.updateConsumerSurface({
        consumerSurface: archived,
        auditScope: fixture.auditScope,
        input: { name: uniqueId('Too Late') }
      })
    );
    expect(error.message).toMatch(/non-active consumer surface/);
  });

  it('manages consumer groups on a surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let name = uniqueId('Group');

    let group = await consumerGroupService.createConsumerGroup({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { name, description: 'Created by the e2e suite', ssoGroupIds: ['sso-e2e'] }
    });
    expect(group.name).toBe(name);
    expect(group.type).toBe('default');
    expect(group.ssoGroupIds).toEqual(['sso-e2e']);

    let fetched = await consumerGroupService.getConsumerGroupById({
      consumerSurface: surface,
      consumerGroupId: group.id
    });
    expect(fetched.id).toBe(group.id);

    let listed = await firstPage(
      await consumerGroupService.listConsumerGroups({ consumerSurface: surface })
    );
    expect(listed.map(item => item.id)).toContain(group.id);

    let renamed = uniqueId('Renamed Group');
    let updated = await consumerGroupService.updateConsumerGroup({
      consumerSurface: surface,
      consumerGroup: fetched,
      auditScope: fixture.auditScope,
      input: { name: renamed, ssoGroupIds: [] }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.ssoGroupIds).toEqual([]);

    let deleted = await consumerGroupService.deleteConsumerGroup({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: updated,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('archived');

    let active = await firstPage(
      await consumerGroupService.listConsumerGroups({ consumerSurface: surface })
    );
    expect(active.map(item => item.id)).not.toContain(group.id);

    let everyone = await db.consumerGroup.findFirstOrThrow({
      where: { surfaceOid: surface.oid, isDefaultEveryoneGroup: true }
    });
    let everyoneError = await rejectionOf(
      consumerGroupService.deleteConsumerGroup({
        organization: fixture.organization,
        consumerSurface: surface,
        consumerGroup: everyone,
        auditScope: fixture.auditScope
      })
    );
    expect(everyoneError.message).toMatch(/default everyone group/);
  });

  it('creates, finds and updates instance consumers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('consumer');

    let consumer = await consumerService.createConsumer({
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      flags: { isManuallyCreated: true },
      input: { name: 'E2E Consumer', email: email.toUpperCase() }
    });
    expect(consumer.email).toBe(email);
    expect(consumer.consumer.isManuallyCreated).toBe(true);

    let fetched = await consumerService.getConsumerById({
      instance: fixture.instance,
      consumerId: consumer.consumer.id
    });
    expect(fetched.id).toBe(consumer.id);

    let found = await consumerService.findConsumersById({
      instance: fixture.instance,
      consumerIds: [consumer.id]
    });
    expect(found.map(item => item.id)).toEqual([consumer.id]);

    let updated = await consumerService.updateConsumer({
      consumer: fetched,
      auditScope: fixture.auditScope,
      input: { name: 'E2E Consumer Renamed' }
    });
    expect(updated.name).toBe('E2E Consumer Renamed');
    expect(updated.consumer.name).toBe('E2E Consumer Renamed');

    let upserted = await consumerService.upsertConsumer({
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: 'E2E Consumer Renamed', email }
    });
    expect(upserted.id).toBe(consumer.id);

    let pending = await consumerService.syncPendingStatus({
      consumer: updated.consumer,
      instance: fixture.instance
    });
    expect(pending).toEqual({ isConsumerPending: false, isInstancePending: false });

    await expect(
      consumerService.getConsumerById({
        instance: fixture.instance,
        consumerId: uniqueId('missing-consumer')
      })
    ).rejects.toThrow();
  });

  it('creates and deletes a consumer profile on a portal surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let email = uniqueEmail('profile');

    let profile = await consumerProfileService.createConsumerProfile({
      surface,
      email,
      name: 'E2E Profile',
      auditScope: fixture.auditScope
    });
    expect(profile.email).toBe(email);
    expect(profile.status).toBe('active');
    expect(profile.inviteStatus).toBe('unset');
    expect(profile.surface.id).toBe(surface.id);
    expect(profile.personalConsumerGroup?.type).toBe('user_access');
    expect(profile.instanceConsumer?.email).toBe(email);
    expect(profile.consumer.isPortalConsumer).toBe(true);

    let fetched = await consumerProfileService.getConsumerProfileById({
      consumerSurface: surface,
      consumerProfileId: profile.id
    });
    expect(fetched.id).toBe(profile.id);

    let duplicate = await rejectionOf(
      consumerProfileService.createConsumerProfile({
        surface,
        email,
        name: 'E2E Profile',
        auditScope: fixture.auditScope
      })
    );
    expect(duplicate.message).toMatch(/already has an active profile/);

    let deleted = await consumerProfileService.deleteConsumerProfile({
      consumerProfile: fetched,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('deleted');

    await expect(
      consumerProfileService.getConsumerProfileById({
        consumerSurface: surface,
        consumerProfileId: profile.id
      })
    ).rejects.toThrow();
  });
});
