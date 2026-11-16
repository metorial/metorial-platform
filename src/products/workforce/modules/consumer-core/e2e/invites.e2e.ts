import {
  eventually,
  expectServiceError,
  firstPage,
  testContext,
  uniqueEmail,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import type { ConsumerSurface, User } from '@metorial/db';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { addDays, subDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  consumerAuthService,
  consumerInviteService,
  consumerProfileService,
  getConsumerInviteExpiresAt
} from '../src';
import {
  captureFabric,
  createConsumerSurface,
  createPortalSurface,
  relayEmailsTo,
  signUpUser
} from './_fixtures';

describe('module-consumer-core invites', () => {
  let org = useOrganization();
  let memberOrg = useOrganization();
  let member = useMember(memberOrg);

  let invite = async (
    fixture: OrganizationFixture,
    surface: ConsumerSurface,
    email = uniqueEmail('invitee'),
    message?: string
  ) =>
    await consumerInviteService.inviteConsumer({
      consumerSurface: surface,
      performedBy: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: 'Invited Consumer', email, message }
    });

  let logIn = async (surface: ConsumerSurface, user: User) =>
    await consumerAuthService.authenticateWithUserAuthSession({
      consumerSurface: surface,
      context: testContext(),
      user,
      authSessionId: uniqueId('auth-session')
    });

  let inviteIds = async (
    surface: ConsumerSurface,
    input: { emails?: string[]; statuses?: string[] } = {}
  ) =>
    (
      await firstPage(
        await consumerInviteService.listConsumerInvites({ consumerSurface: surface, ...input })
      )
    ).map(item => item.id);

  it('invites a consumer with a pending invite and emails the portal invitation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, portal } = await createPortalSurface(fixture);
    let email = uniqueEmail('invitee');
    let created = captureFabric('consumer.invite.created:after');

    let result = await invite(fixture, surface, email.toUpperCase(), 'Welcome aboard');
    created.stop();

    expect(result).toMatchObject({
      status: 'pending',
      message: 'Welcome aboard',
      acceptedAt: null,
      surfaceOid: surface.oid,
      organizationOid: fixture.organization.oid,
      invitedByOid: fixture.actor.oid
    });
    expect(result.consumerProfile).toMatchObject({ email, inviteStatus: 'invited' });
    expect(result.expiresAt.getTime()).toBeGreaterThan(addDays(new Date(), 13).getTime());
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(addDays(new Date(), 14).getTime());
    expect(created.events.map(event => event.consumerInvite.id)).toEqual([result.id]);

    await eventually(
      async () => {
        let emails = await relayEmailsTo(email);
        expect(emails.map(sent => sent.subject)).toContain(`You're invited to ${portal.name}`);
      },
      { timeoutMs: 60_000 }
    );
  });

  it('re-inviting a pending invitee refreshes the same invite', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('reinvite');
    let first = await invite(fixture, surface, email);

    await db.consumerInvite.update({
      where: { oid: first.oid },
      data: { expiresAt: addDays(new Date(), 1) }
    });

    let updated = captureFabric('consumer.invite.updated:after');
    let second = await invite(fixture, surface, email, 'Second try');
    updated.stop();

    expect(second).toMatchObject({ id: first.id, status: 'pending', message: 'Second try' });
    expect(second.expiresAt.getTime()).toBeGreaterThan(addDays(new Date(), 13).getTime());
    expect(updated.events.map(event => event.consumerInvite.id)).toEqual([first.id]);
    expect(await db.consumerInvite.count({ where: { surfaceOid: surface.oid } })).toBe(1);
    expect(await db.consumerProfile.count({ where: { surfaceOid: surface.oid } })).toBe(1);
  });

  it('accepts an invite when the invitee logs in and rejects further invites', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('accept');
    let pending = await invite(fixture, surface, email);
    let user = await signUpUser(email);
    let updated = captureFabric('consumer.invite.updated:after');

    let session = await logIn(surface, user);
    updated.stop();

    expect(session.consumerProfile).toMatchObject({
      oid: pending.consumerProfileOid,
      inviteStatus: 'accepted'
    });
    expect(session.expiresAt.getTime()).toBeGreaterThan(addDays(new Date(), 300).getTime());
    expect(updated.events.map(event => event.consumerInvite.id)).toEqual([pending.id]);

    let accepted = await db.consumerInvite.findUniqueOrThrow({ where: { oid: pending.oid } });
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedAt).toBeInstanceOf(Date);

    expect(await inviteIds(surface, { statuses: ['accepted'] })).toEqual([pending.id]);
    expect(await inviteIds(surface, { statuses: ['pending'] })).toEqual([]);
    expect(await inviteIds(surface, { emails: [email.toUpperCase()] })).toEqual([pending.id]);

    await expectServiceError(invite(fixture, surface, email), 'conflict');
    await expectServiceError(
      consumerInviteService.deleteConsumerInvite({
        consumerSurface: surface,
        consumerInviteId: pending.id,
        auditScope: fixture.auditScope
      }),
      'not_found'
    );
  });

  it('revokes a pending invite so the invitee can no longer accept it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('revoke');
    let pending = await invite(fixture, surface, email);
    let deleted = captureFabric('consumer.invite.deleted:after');

    let revoke = () =>
      consumerInviteService.deleteConsumerInvite({
        consumerSurface: surface,
        consumerInviteId: pending.id,
        auditScope: fixture.auditScope
      });
    await revoke();
    deleted.stop();

    expect(deleted.events.map(event => event.consumerInvite.id)).toEqual([pending.id]);
    expect(await db.consumerInvite.count({ where: { oid: pending.oid } })).toBe(0);
    await expectServiceError(revoke(), 'not_found');

    let user = await signUpUser(email);
    await expectServiceError(logIn(surface, user), 'forbidden');

    let profile = await db.consumerProfile.findUniqueOrThrow({
      where: { oid: pending.consumerProfileOid }
    });
    expect(profile.inviteStatus).toBe('invited');
    expect(
      await db.consumerSession.count({ where: { consumerProfileOid: profile.oid } })
    ).toBe(0);
  });

  it('rejects accepting an expired invite', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('expired');
    let pending = await invite(fixture, surface, email);
    expect(pending.legacyGraceStartedAt).toBeNull();

    await db.consumerInvite.update({
      where: { oid: pending.oid },
      data: { expiresAt: subDays(new Date(), 1) }
    });

    let user = await signUpUser(email);
    let rejected = await expectServiceError(logIn(surface, user), 'forbidden');
    expect(rejected.message).toMatch(/expired/);

    expect(
      await db.consumerProfile.findUniqueOrThrow({
        where: { oid: pending.consumerProfileOid }
      })
    ).toMatchObject({ inviteStatus: 'invited' });
    expect(
      await db.consumerInvite.findUniqueOrThrow({ where: { oid: pending.oid } })
    ).toMatchObject({ status: 'pending', acceptedAt: null });
    expect(
      await db.consumerSession.count({
        where: { consumerProfileOid: pending.consumerProfileOid }
      })
    ).toBe(0);
  });

  it('gives invites that predate expiry 14 days from deploy', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let legacyInvite = async (graceStartedDaysAgo: number) => {
      let email = uniqueEmail('legacy');
      let pending = await invite(fixture, surface, email);
      let legacy = await db.consumerInvite.update({
        where: { oid: pending.oid },
        data: {
          expiresAt: subDays(new Date(), 120),
          legacyGraceStartedAt: subDays(new Date(), graceStartedDaysAgo)
        }
      });

      return { legacy, user: await signUpUser(email) };
    };

    let withinGrace = await legacyInvite(1);
    expect(getConsumerInviteExpiresAt(withinGrace.legacy).getTime()).toBe(
      addDays(withinGrace.legacy.legacyGraceStartedAt!, 14).getTime()
    );
    let session = await logIn(surface, withinGrace.user);
    expect(session.consumerProfile).toMatchObject({
      oid: withinGrace.legacy.consumerProfileOid,
      inviteStatus: 'accepted'
    });
    expect(
      await db.consumerInvite.findUniqueOrThrow({ where: { oid: withinGrace.legacy.oid } })
    ).toMatchObject({ status: 'accepted' });

    let pastGrace = await legacyInvite(15);
    let rejected = await expectServiceError(logIn(surface, pastGrace.user), 'forbidden');
    expect(rejected.message).toMatch(/expired/);
  });

  it('lets an invitee with independent access join through an expired invite', async () => {
    let fixture = await loadOrganizationFixture(memberOrg.ids);
    let { surface } = await createPortalSurface(fixture);
    await db.project.update({
      where: { oid: fixture.project.oid },
      data: { autoAddOrganizationMembersToPortals: true }
    });

    let pending = await invite(fixture, surface, member.user.email);
    expect(pending.consumerProfile.inviteStatus).toBe('invited');
    await db.consumerInvite.update({
      where: { oid: pending.oid },
      data: { expiresAt: subDays(new Date(), 30) }
    });

    let user = await db.user.findUniqueOrThrow({ where: { id: member.user.id } });
    let session = await logIn(surface, user);

    expect(session.consumerProfile).toMatchObject({
      oid: pending.consumerProfileOid,
      inviteStatus: 'accepted'
    });
    expect(
      await db.consumerInvite.findUniqueOrThrow({ where: { oid: pending.oid } })
    ).toMatchObject({ status: 'accepted' });
  });

  it('lets an SSO-granted invitee join through an expired invite', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let email = uniqueEmail('sso');
    let pending = await invite(fixture, surface, email);
    await db.consumerInvite.update({
      where: { oid: pending.oid },
      data: { expiresAt: subDays(new Date(), 30) }
    });

    let granted = await consumerProfileService.ensureConsumerProfile({
      surface,
      email,
      name: 'SSO Consumer',
      inviteStatus: 'accepted',
      auditScope: fixture.auditScope
    });
    expect(granted).toMatchObject({
      oid: pending.consumerProfileOid,
      inviteStatus: 'accepted'
    });
    expect(
      await db.consumerInvite.findUniqueOrThrow({ where: { oid: pending.oid } })
    ).toMatchObject({ status: 'accepted' });

    let session = await logIn(surface, await signUpUser(email));
    expect(session.consumerProfile.oid).toBe(pending.consumerProfileOid);
  });

  it('does not resolve or revoke invites through another surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let otherSurface = await createConsumerSurface(fixture);
    let pending = await invite(fixture, surface);

    await expectServiceError(
      consumerInviteService.getConsumerInviteById({
        consumerSurface: otherSurface,
        consumerInviteId: pending.id
      }),
      'not_found'
    );
    await expectServiceError(
      consumerInviteService.deleteConsumerInvite({
        consumerSurface: otherSurface,
        consumerInviteId: pending.id,
        auditScope: fixture.auditScope
      }),
      'not_found'
    );

    expect(await inviteIds(otherSurface)).toEqual([]);
    expect(await inviteIds(surface)).toEqual([pending.id]);
    expect(
      (
        await consumerInviteService.getConsumerInviteById({
          consumerSurface: surface,
          consumerInviteId: pending.id
        })
      ).status
    ).toBe('pending');
  });
});
