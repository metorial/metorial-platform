import { expectServiceError, firstPage, uniqueEmail, useOrganization } from '@metorial/e2e';
import type { ConsumerGroup, ConsumerSurface } from '@metorial/db';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerGroupService, consumerProfileService } from '../src';
import {
  captureFabric,
  createConsumerGroup,
  createConsumerProfile,
  createConsumerSurface
} from './_fixtures';

describe('module-consumer-core groups and membership', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let everyoneGroup = async (surface: ConsumerSurface) =>
    await db.consumerGroup.findFirstOrThrow({
      where: { surfaceOid: surface.oid, isDefaultEveryoneGroup: true }
    });

  let profileIds = async (
    surface: ConsumerSurface,
    input: { consumerGroupId?: string; visibleToConsumerGroups?: ConsumerGroup[] }
  ) =>
    (
      await firstPage(
        await consumerProfileService.listConsumerProfiles({
          consumerSurface: surface,
          ...input
        })
      )
    ).map(profile => profile.id);

  it('updates a group without dropping its default flag and archives it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let created = captureFabric('consumer.group.created:after');

    let group = await createConsumerGroup(fixture, surface, { isDefault: true });
    created.stop();

    expect(created.events.map(event => event.consumerGroup.id)).toEqual([group.id]);
    expect(
      (await db.accessTag.findUniqueOrThrow({ where: { oid: group.accessTagOid } }))
        .instanceOid
    ).toBe(fixture.instance.oid);

    let updated = captureFabric('consumer.group.updated:after');
    let renamed = await consumerGroupService.updateConsumerGroup({
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      input: { name: `${group.name} renamed` }
    });
    expect(renamed).toMatchObject({ name: `${group.name} renamed`, isDefault: true });

    let undefaulted = await consumerGroupService.updateConsumerGroup({
      consumerSurface: surface,
      consumerGroup: renamed,
      auditScope: fixture.auditScope,
      input: { isDefault: false }
    });
    updated.stop();

    expect(undefaulted.isDefault).toBe(false);
    expect(updated.events.map(event => event.previousConsumerGroup.name)).toEqual([
      group.name,
      `${group.name} renamed`
    ]);

    let archivedEvents = captureFabric('consumer.group.archived:after');
    let archived = await consumerGroupService.deleteConsumerGroup({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: undefaulted,
      auditScope: fixture.auditScope
    });
    archivedEvents.stop();

    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(archivedEvents.events.map(event => event.consumerGroup.id)).toEqual([group.id]);

    let archivedList = await firstPage(
      await consumerGroupService.listConsumerGroups({
        consumerSurface: surface,
        status: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toEqual([group.id]);

    await expectServiceError(
      consumerGroupService.updateConsumerGroup({
        consumerSurface: surface,
        consumerGroup: archived,
        auditScope: fixture.auditScope,
        input: { name: 'Too late' }
      }),
      'precondition_failed'
    );
    await expectServiceError(
      consumerGroupService.deleteConsumerGroup({
        organization: fixture.organization,
        consumerSurface: surface,
        consumerGroup: archived,
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );
  });

  it('keeps the everyone group default and free of SSO groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let everyone = await everyoneGroup(surface);

    let updated = await consumerGroupService.updateConsumerGroup({
      consumerSurface: surface,
      consumerGroup: everyone,
      auditScope: fixture.auditScope,
      input: { name: 'All consumers', isDefault: false, ssoGroupIds: ['sso-everyone'] }
    });

    expect(updated).toMatchObject({
      name: 'All consumers',
      isDefault: true,
      ssoGroupIds: [],
      isDefaultEveryoneGroup: true
    });
  });

  it('does not treat personal groups as regular groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let personal = profile.personalConsumerGroup;

    expect(personal).toMatchObject({ type: 'user_access', isDefault: false });

    await expectServiceError(
      consumerGroupService.getConsumerGroupById({
        consumerSurface: surface,
        consumerGroupId: personal.id
      }),
      'not_found'
    );
    let asUserAccess = await consumerGroupService.getConsumerGroupById({
      consumerSurface: surface,
      consumerGroupId: personal.id,
      types: ['user_access']
    });
    expect(asUserAccess.id).toBe(personal.id);

    await expectServiceError(
      consumerGroupService.updateConsumerGroup({
        consumerSurface: surface,
        consumerGroup: personal,
        auditScope: fixture.auditScope,
        input: { name: 'Hijacked' }
      }),
      'not_found'
    );
    await expectServiceError(
      consumerGroupService.deleteConsumerGroup({
        organization: fixture.organization,
        consumerSurface: surface,
        consumerGroup: personal,
        auditScope: fixture.auditScope
      }),
      'not_found'
    );

    let listed = await firstPage(
      await consumerGroupService.listConsumerGroups({ consumerSurface: surface })
    );
    expect(listed.map(item => item.id)).not.toContain(personal.id);
  });

  it('assigns profiles to groups idempotently and removes them again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let group = await createConsumerGroup(fixture, surface);
    let member = await createConsumerProfile(fixture, surface);
    let outsider = await createConsumerProfile(fixture, surface);
    let added = captureFabric('consumer.profile.group.added:after');

    let assign = () =>
      consumerProfileService.assignToGroups({
        consumerProfile: member,
        groupIds: [group.id, group.id],
        auditScope: fixture.auditScope
      });
    await assign();
    await assign();
    added.stop();

    expect(added.events.map(event => event.consumerGroup.id)).toEqual([group.id]);
    let memberships = await db.consumerProfileGroup.findMany({
      where: { groupOid: group.oid }
    });
    expect(
      memberships.map(membership => [membership.profileOid, membership.assignedVia])
    ).toEqual([[member.oid, 'manual']]);

    let inGroup = await profileIds(surface, { consumerGroupId: group.id });
    expect(inGroup).toEqual([member.id]);
    expect(
      await profileIds(surface, { consumerGroupId: (await everyoneGroup(surface)).id })
    ).toEqual(expect.arrayContaining([member.id, outsider.id]));

    let removed = captureFabric('consumer.profile.group.removed:after');
    let remove = () =>
      consumerProfileService.removeFromGroups({
        consumerProfile: member,
        groupIds: [group.id],
        auditScope: fixture.auditScope
      });
    await remove();
    await remove();
    removed.stop();

    expect(removed.events.map(event => event.consumerGroup.id)).toEqual([group.id]);
    expect(await db.consumerProfileGroup.count({ where: { groupOid: group.oid } })).toBe(0);
    expect(await profileIds(surface, { consumerGroupId: group.id })).toEqual([]);
  });

  it('rejects assignments to archived, personal and foreign groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let other = await createConsumerProfile(fixture, surface);

    let archived = await consumerGroupService.deleteConsumerGroup({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: await createConsumerGroup(fixture, surface),
      auditScope: fixture.auditScope
    });
    let foreign = await createConsumerGroup(fixture, await createConsumerSurface(fixture));
    let valid = await createConsumerGroup(fixture, surface);

    for (let groupId of [archived.id, other.personalConsumerGroup.id, foreign.id]) {
      await expectServiceError(
        consumerProfileService.assignToGroups({
          consumerProfile: profile,
          groupIds: [valid.id, groupId],
          auditScope: fixture.auditScope
        }),
        'not_found'
      );
    }

    expect(await db.consumerProfileGroup.count({ where: { profileOid: profile.oid } })).toBe(
      0
    );
  });

  it('resolves effective groups and access tags across personal, default, manual and SSO groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let everyone = await everyoneGroup(surface);
    let manual = await createConsumerGroup(fixture, surface);
    let sso = await createConsumerGroup(fixture, surface, {
      ssoGroupIds: ['sso-engineering']
    });
    let unrelated = await createConsumerGroup(fixture, surface, {
      ssoGroupIds: ['sso-sales']
    });

    let profile = await consumerProfileService.ensureConsumerProfile({
      surface,
      email: uniqueEmail('effective'),
      name: 'Effective Profile',
      auditScope: fixture.auditScope,
      ssoGroupIds: ['sso-engineering']
    });
    await consumerProfileService.assignToGroups({
      consumerProfile: profile,
      groupIds: [manual.id],
      auditScope: fixture.auditScope
    });

    let effective = await consumerProfileService.getGroupsForProfile({
      consumerProfile: profile
    });
    let assignedVia = Object.fromEntries(
      effective.map(group => [group.id, group.assignedVia])
    );

    expect(assignedVia).toEqual({
      [profile.personalConsumerGroup.id]: 'user',
      [everyone.id]: 'default',
      [manual.id]: 'manual',
      [sso.id]: 'sso'
    });
    expect(assignedVia[unrelated.id]).toBeUndefined();
    expect(await profileIds(surface, { consumerGroupId: sso.id })).toEqual([profile.id]);

    await consumerGroupService.deleteConsumerGroup({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: manual,
      auditScope: fixture.auditScope
    });
    let afterArchive = await consumerProfileService.getGroupsForProfile({
      consumerProfile: profile
    });
    expect(afterArchive.map(group => group.id)).not.toContain(manual.id);
  });

  it('limits profile visibility to profiles that share a non-default group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let team = await createConsumerGroup(fixture, surface);
    let viewer = await createConsumerProfile(fixture, surface);
    let teammate = await createConsumerProfile(fixture, surface);
    let stranger = await createConsumerProfile(fixture, surface);

    for (let consumerProfile of [viewer, teammate]) {
      await consumerProfileService.assignToGroups({
        consumerProfile,
        groupIds: [team.id],
        auditScope: fixture.auditScope
      });
    }

    let visible = await profileIds(surface, {
      visibleToConsumerGroups: [team, viewer.personalConsumerGroup]
    });
    expect(visible.sort()).toEqual([viewer.id, teammate.id].sort());

    await expectServiceError(
      consumerProfileService.getConsumerProfileVisibleToConsumer({
        consumerSurface: surface,
        consumerProfile: viewer,
        consumerGroups: [team],
        consumerProfileId: stranger.id
      }),
      'not_found'
    );

    let withEveryone = await profileIds(surface, {
      visibleToConsumerGroups: [team, await everyoneGroup(surface)]
    });
    expect(withEveryone).toEqual(
      expect.arrayContaining([viewer.id, teammate.id, stranger.id])
    );
  });

  it('does not resolve groups through another surface or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createConsumerSurface(fixture);
    let group = await createConsumerGroup(fixture, surface);

    for (let consumerSurface of [
      await createConsumerSurface(fixture),
      await createConsumerSurface(other)
    ]) {
      await expectServiceError(
        consumerGroupService.getConsumerGroupById({
          consumerSurface,
          consumerGroupId: group.id
        }),
        'not_found'
      );

      let listed = await firstPage(
        await consumerGroupService.listConsumerGroups({ consumerSurface })
      );
      expect(listed.map(item => item.id)).not.toContain(group.id);
    }
  });
});
