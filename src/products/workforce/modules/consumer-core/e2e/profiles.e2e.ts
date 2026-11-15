import { expectServiceError, firstPage, uniqueEmail, useOrganization } from '@metorial/e2e';
import type { ConsumerSurface } from '@metorial/db';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerProfileService } from '../src';
import { captureFabric, createConsumerProfile, createConsumerSurface } from './_fixtures';

describe('module-consumer-core profiles', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let listIds = async (
    surface: ConsumerSurface,
    input: { emails?: string[]; statuses?: Array<'active' | 'invited'> } = {}
  ) =>
    (
      await firstPage(
        await consumerProfileService.listConsumerProfiles({
          consumerSurface: surface,
          ...input
        })
      )
    ).map(profile => profile.id);

  it('creates a profile with its personal group, organization actor and consumer link', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('profile');
    let created = captureFabric('consumer.profile.created:after');

    let profile = await createConsumerProfile(fixture, surface, {
      email: email.toUpperCase(),
      name: 'Profile Person'
    });
    created.stop();

    expect(profile).toMatchObject({
      email,
      name: 'Profile Person',
      status: 'active',
      inviteStatus: 'unset',
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      surfaceOid: surface.oid,
      organizationMemberOid: null
    });
    expect(created.events.map(event => event.consumerProfile.id)).toEqual([profile.id]);

    expect(profile.personalConsumerGroup).toMatchObject({
      type: 'user_access',
      status: 'active',
      surfaceOid: surface.oid,
      accessTagOid: profile.accessTagOid
    });
    expect(profile.instanceConsumer).toMatchObject({
      consumerOid: profile.consumerOid,
      instanceOid: fixture.instance.oid,
      email
    });

    let actor = await db.organizationActor.findUniqueOrThrow({
      where: { oid: profile.organizationActorOid! }
    });
    expect(actor).toMatchObject({
      type: 'consumer_profile',
      name: 'Profile Person',
      organizationOid: fixture.organization.oid
    });
    expect(
      await db.consumerOrganizationActor.count({
        where: { consumerOid: profile.consumerOid, organizationActorOid: actor.oid }
      })
    ).toBe(1);
  });

  it('rejects a second active profile for the same email on a surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('duplicate-profile');
    await createConsumerProfile(fixture, surface, { email });

    await expectServiceError(
      createConsumerProfile(fixture, surface, { email: email.toUpperCase() }),
      'conflict'
    );

    expect(await db.consumerProfile.count({ where: { surfaceOid: surface.oid } })).toBe(1);

    let elsewhere = await createConsumerProfile(
      fixture,
      await createConsumerSurface(fixture),
      {
        email
      }
    );
    expect(elsewhere.surfaceOid).not.toBe(surface.oid);
  });

  it('deletes a profile by scrubbing it and allows the email to be reused', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('deleted-profile');
    let profile = await createConsumerProfile(fixture, surface, { email });
    let deleted = captureFabric('consumer.profile.deleted:after');

    let result = await consumerProfileService.deleteConsumerProfile({
      consumerProfile: profile,
      auditScope: fixture.auditScope
    });
    deleted.stop();

    expect(result).toMatchObject({ id: profile.id, status: 'deleted', name: '[deleted]' });
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.email).toMatch(/@deleted\.metorial\.com$/);
    expect(deleted.events.map(event => event.consumerProfile.id)).toEqual([profile.id]);

    await expectServiceError(
      consumerProfileService.getConsumerProfileById({
        consumerSurface: surface,
        consumerProfileId: profile.id
      }),
      'not_found'
    );
    expect(await listIds(surface)).toEqual([]);

    await expectServiceError(
      consumerProfileService.deleteConsumerProfile({
        consumerProfile: result,
        auditScope: fixture.auditScope
      }),
      'conflict'
    );

    let recreated = await createConsumerProfile(fixture, surface, { email });
    expect(recreated.id).not.toBe(profile.id);
    expect(recreated.consumerOid).toBe(profile.consumerOid);
    expect(await listIds(surface, { emails: [email] })).toEqual([recreated.id]);
  });

  it('filters profiles by email and invite status', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let active = await createConsumerProfile(fixture, surface);
    let invited = await consumerProfileService.ensureConsumerProfile({
      surface,
      email: uniqueEmail('invited-profile'),
      name: 'Invited Profile',
      auditScope: fixture.auditScope,
      inviteStatus: 'invited'
    });

    expect((await listIds(surface)).sort()).toEqual([active.id, invited.id].sort());
    expect(await listIds(surface, { statuses: ['active'] })).toEqual([active.id]);
    expect(await listIds(surface, { statuses: ['invited'] })).toEqual([invited.id]);
    expect((await listIds(surface, { statuses: ['active', 'invited'] })).sort()).toEqual(
      [active.id, invited.id].sort()
    );
    expect(await listIds(surface, { emails: [invited.email.toUpperCase()] })).toEqual([
      invited.id
    ]);
    expect(await listIds(surface, { emails: [uniqueEmail('nobody')] })).toEqual([]);
  });

  it('lists the profiles of one consumer across the surfaces of its instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('multi-surface');
    let first = await createConsumerProfile(fixture, await createConsumerSurface(fixture), {
      email
    });
    let second = await createConsumerProfile(fixture, await createConsumerSurface(fixture), {
      email
    });
    let unrelated = await createConsumerProfile(fixture, await createConsumerSurface(fixture));

    let consumer = first.instanceConsumer!;
    let profiles = await firstPage(
      await consumerProfileService.listConsumerProfilesForConsumer({ consumer })
    );
    expect(profiles.map(profile => profile.id).sort()).toEqual([first.id, second.id].sort());

    let resolved = await consumerProfileService.getConsumerProfileByIdForConsumer({
      consumer,
      consumerProfileId: second.id
    });
    expect(resolved.id).toBe(second.id);

    await expectServiceError(
      consumerProfileService.getConsumerProfileByIdForConsumer({
        consumer,
        consumerProfileId: unrelated.id
      }),
      'not_found'
    );
  });

  it('does not resolve profiles through another surface, instance or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let otherSurface = await createConsumerSurface(other);

    for (let consumerSurface of [await createConsumerSurface(fixture), otherSurface]) {
      await expectServiceError(
        consumerProfileService.getConsumerProfileById({
          consumerSurface,
          consumerProfileId: profile.id
        }),
        'not_found'
      );
      expect(await listIds(consumerSurface, { emails: [profile.email] })).toEqual([]);
    }

    await expectServiceError(
      consumerProfileService.getConsumerProfileByIdForInstance({
        instance: other.instance,
        consumerProfileId: profile.id
      }),
      'not_found'
    );
    expect(
      await consumerProfileService.findConsumerProfilesByIdForInstance({
        instance: other.instance,
        consumerProfileIds: [profile.id]
      })
    ).toEqual([]);
    expect(
      (
        await consumerProfileService.getConsumerProfileByIdForInstance({
          instance: fixture.instance,
          consumerProfileId: profile.id
        })
      ).id
    ).toBe(profile.id);

    await expectServiceError(
      consumerProfileService.getConsumerProfileByIdForConsumer({
        consumer: {
          instanceOid: other.instance.oid,
          consumerOid: profile.consumerOid
        },
        consumerProfileId: profile.id
      }),
      'not_found'
    );
  });
});
