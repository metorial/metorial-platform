import {
  eventually,
  rejectionOf,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import {
  db,
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import {
  consumerInviteService,
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { identityActorService, identityService } from '@metorial-subspace/module-identity';
import { describe, expect, it } from 'vitest';
import { consumerActorService } from '../src';

let createSurface = async (fixture: OrganizationFixture) =>
  consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Deletion Surface'), sessionExpiryTimeInSeconds: 3600 }
  });

describe('consumer profile deletion', () => {
  let org = useOrganization();

  it('removes pending invitations and archives only the deleted profile actors and identities', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let otherSurface = await createSurface(fixture);
    let email = uniqueEmail('deleted-profile');
    let invite = await consumerInviteService.inviteConsumer({
      consumerSurface: surface,
      performedBy: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: 'Invited Consumer', email }
    });
    let profile = await consumerProfileService.getConsumerProfileById({
      consumerSurface: surface,
      consumerProfileId: invite.consumerProfile.id
    });
    let other = await consumerProfileService.createConsumerProfile({
      surface: otherSurface,
      name: 'Other Profile',
      email,
      auditScope: fixture.auditScope
    });
    expect(other.consumerOid).toBe(profile.consumerOid);
    let actor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: profile
    });
    let otherActor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: other
    });
    let extraActor = await identityActorService.createIdentityActor({
      instance: fixture.instance,
      consumerOwner: {
        consumerId: profile.consumer.id,
        instanceConsumerId: profile.instanceConsumer!.id,
        consumerProfileId: profile.id
      },
      input: { name: 'Second Profile Actor', type: 'consumer' }
    });
    let extraIdentity = await identityService.createIdentity({
      instance: fixture.instance,
      actor: extraActor,
      input: { name: 'Second Identity', inputs: [] }
    });
    let secondDefaultIdentity = await identityService.createIdentity({
      instance: fixture.instance,
      actor: await identityActorService.getIdentityActorById({
        instance: fixture.instance,
        identityActorId: actor.id
      }),
      input: { name: 'Additional Identity', inputs: [] }
    });

    let deleted = await consumerProfileService.deleteConsumerProfile({
      consumerProfile: profile,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('deleted');
    expect(await db.consumerInvite.findUnique({ where: { id: invite.id } })).toBeNull();
    expect(
      (await db.consumerProfile.findUniqueOrThrow({ where: { id: profile.id } })).deletedAt
    ).toBeTruthy();
    await eventually(async () => {
      for (let id of [actor.id, extraActor.id]) {
        expect(
          (await subspaceDb.identityActor.findUniqueOrThrow({ where: { id } })).status
        ).toBe('archived');
      }
      for (let id of [actor.defaultIdentityId!, extraIdentity.id, secondDefaultIdentity.id]) {
        expect((await subspaceDb.identity.findUniqueOrThrow({ where: { id } })).status).toBe(
          'archived'
        );
      }
    });
    expect(
      (await db.consumerProfile.findUniqueOrThrow({ where: { id: other.id } })).status
    ).toBe('active');
    expect(
      (await subspaceDb.identityActor.findUniqueOrThrow({ where: { id: otherActor.id } }))
        .status
    ).toBe('active');
    expect(
      (
        await subspaceDb.identity.findUniqueOrThrow({
          where: { id: otherActor.defaultIdentityId! }
        })
      ).status
    ).toBe('active');

    let error = await rejectionOf(
      consumerActorService.ensureDefaultConsumerActor({
        instance: fixture.instance,
        consumerProfile: profile
      })
    );
    expect(error.data.code).toBe('not_found');
    await consumerActorService.syncInstanceConsumerActors({
      instanceConsumerId: profile.instanceConsumer!.id
    });
    expect(
      (await subspaceDb.identityActor.findUniqueOrThrow({ where: { id: actor.id } })).status
    ).toBe('archived');
    expect(
      (await db.consumerProfile.findUniqueOrThrow({ where: { id: profile.id } })).name
    ).toBe('[deleted]');

    let reinvite = await consumerInviteService.inviteConsumer({
      consumerSurface: surface,
      performedBy: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: 'Reinvited Consumer', email }
    });
    expect(reinvite.consumerProfile.id).not.toBe(profile.id);
    expect(reinvite.status).toBe('pending');
  });

  it('archives active profile identities while retaining accepted invitation history', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let invite = await consumerInviteService.inviteConsumer({
      consumerSurface: surface,
      performedBy: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: 'Accepted Consumer', email: uniqueEmail('accepted-profile') }
    });
    let profile = await consumerProfileService.getConsumerProfileById({
      consumerSurface: surface,
      consumerProfileId: invite.consumerProfile.id
    });
    await consumerProfileService.activateConsumerProfile({
      consumerProfile: profile,
      auditScope: fixture.auditScope
    });
    profile = await consumerProfileService.getConsumerProfileById({
      consumerSurface: surface,
      consumerProfileId: profile.id
    });
    let actor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile: profile
    });
    await consumerProfileService.deleteConsumerProfile({
      consumerProfile: profile,
      auditScope: fixture.auditScope
    });
    expect(
      (await db.consumerInvite.findUniqueOrThrow({ where: { id: invite.id } })).status
    ).toBe('accepted');
    await eventually(async () => {
      expect(
        (await subspaceDb.identityActor.findUniqueOrThrow({ where: { id: actor.id } })).status
      ).toBe('archived');
      expect(
        (
          await subspaceDb.identity.findUniqueOrThrow({
            where: { id: actor.defaultIdentityId! }
          })
        ).status
      ).toBe('archived');
    });
    await expect(
      consumerProfileService.getConsumerProfileById({
        consumerSurface: surface,
        consumerProfileId: profile.id
      })
    ).rejects.toThrow();
  });
});
