import {
  eventually,
  expectServiceError,
  firstPage,
  testContext,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import type { ConsumerSurface, User } from '@metorial/db';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { addDays, subDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { consumerAuthService, consumerInviteService } from '../src';
import {
  captureFabric,
  createConsumerSurface,
  createPortalSurface,
  relayEmailsTo,
  signUpUser
} from './_fixtures';

describe('module-consumer-core invites', () => {
  let org = useOrganization();

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

  it.fails(
    'rejects accepting an expired invite (bug: expiresAt is never checked; enforcing it needs a decision on legacy invites whose expiresAt defaulted to the migration time)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let surface = await createConsumerSurface(fixture);
      let email = uniqueEmail('expired');
      let pending = await invite(fixture, surface, email);

      await db.consumerInvite.update({
        where: { oid: pending.oid },
        data: { expiresAt: subDays(new Date(), 1) }
      });

      let user = await signUpUser(email);
      await expectServiceError(logIn(surface, user), 'forbidden');
    }
  );

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
