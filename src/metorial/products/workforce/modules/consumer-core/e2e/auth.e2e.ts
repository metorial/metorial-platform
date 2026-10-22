import { expectServiceError, testContext, uniqueId, useOrganization } from '@metorial/e2e';
import { authenticateWithConsumerToken } from '@metorial/consumer-auth';
import type { ConsumerProfile, ConsumerSurface } from '@metorial/db';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { addDays, subMinutes } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { consumerAuthService, consumerProfileService } from '../src';
import {
  captureFabric,
  createConsumerGroup,
  createConsumerProfile,
  createConsumerSurface,
  signUpUser
} from './_fixtures';

describe('module-consumer-core consumer auth', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let startSession = async (surface: ConsumerSurface, profile: ConsumerProfile) => {
    let session = await consumerAuthService.createConsumerSession({
      consumerSurface: surface,
      consumerProfile: profile,
      context: testContext()
    });
    let token = await consumerAuthService.getConsumerSessionToken({ session, surface });
    return { session, token };
  };

  let authenticate = (token: string, surface: ConsumerSurface) =>
    consumerAuthService.authenticateWithConsumerSessionToken({ token, surface });

  it('issues a session that expires with the surface session lifetime', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture, { sessionExpiryTimeInSeconds: 600 });
    let profile = await createConsumerProfile(fixture, surface);
    let created = captureFabric('consumer.session.created:after');

    let before = Date.now();
    let { session, token } = await startSession(surface, profile);
    created.stop();

    expect(session).toMatchObject({
      consumerProfileOid: profile.oid,
      authSessionId: null,
      loggedOutAt: null
    });
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 600_000);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 600_000);
    expect(created.events.map(event => event.consumerSession.id)).toEqual([session.id]);

    let authenticated = await authenticate(token, surface);
    expect(authenticated.id).toBe(session.id);
    expect(authenticated.consumerProfile.id).toBe(profile.id);
  });

  it('rejects session tokens on other surfaces, of the wrong type, or malformed', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let { session, token } = await startSession(surface, profile);
    let consumerToken = await consumerAuthService.getConsumerToken({ session, surface });

    for (let otherSurface of [
      await createConsumerSurface(fixture),
      await createConsumerSurface(other)
    ]) {
      await expectServiceError(authenticate(token, otherSurface), 'unauthorized');
    }

    for (let invalid of [consumerToken, 'garbage', `${token.slice(0, -4)}AAAA`]) {
      await expectServiceError(authenticate(invalid, surface), 'unauthorized');
    }
  });

  it('accepts consumer tokens only within the issuing organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let { session, token } = await startSession(surface, profile);
    let consumerToken = await consumerAuthService.getConsumerToken({ session, surface });

    let authenticated = await authenticateWithConsumerToken({
      token: consumerToken,
      organization: fixture.organization
    });
    expect(authenticated.session.id).toBe(session.id);
    expect(authenticated.surface.id).toBe(surface.id);

    await expectServiceError(
      authenticateWithConsumerToken({
        token: consumerToken,
        organization: other.organization
      }),
      'unauthorized'
    );
    await expectServiceError(
      authenticateWithConsumerToken({ token, organization: fixture.organization }),
      'unauthorized'
    );
  });

  it('revokes a session once and rejects its tokens afterwards', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let { session, token } = await startSession(surface, profile);
    let consumerToken = await consumerAuthService.getConsumerToken({ session, surface });
    let revokedEvents = captureFabric('consumer.session.revoked:after');

    let revoked = await consumerAuthService.revokeConsumerSession({
      session,
      auditScope: fixture.auditScope
    });
    let again = await consumerAuthService.revokeConsumerSession({
      session: revoked,
      auditScope: fixture.auditScope
    });
    revokedEvents.stop();

    expect(revoked.loggedOutAt).toBeInstanceOf(Date);
    expect(again.loggedOutAt).toEqual(revoked.loggedOutAt);
    expect(revokedEvents.events.map(event => event.consumerSession.id)).toEqual([session.id]);

    await expectServiceError(authenticate(token, surface), 'unauthorized');
    await expectServiceError(
      authenticateWithConsumerToken({
        token: consumerToken,
        organization: fixture.organization
      }),
      'unauthorized'
    );
  });

  it('rejects the tokens of an expired session', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let { session, token } = await startSession(surface, profile);

    await db.consumerSession.update({
      where: { oid: session.oid },
      data: { expiresAt: subMinutes(new Date(), 1) }
    });

    await expectServiceError(authenticate(token, surface), 'unauthorized');
  });

  it('logs out the sessions of a deleted profile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let { session, token } = await startSession(surface, profile);

    await consumerProfileService.deleteConsumerProfile({
      consumerProfile: profile,
      auditScope: fixture.auditScope
    });

    expect(
      (await db.consumerSession.findUniqueOrThrow({ where: { oid: session.oid } })).loggedOutAt
    ).toBeInstanceOf(Date);
    await expectServiceError(authenticate(token, surface), 'unauthorized');
  });

  it('reuses the session of a user auth session and renews it after logout', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let user = await signUpUser();
    let profile = await createConsumerProfile(fixture, surface, { email: user.email });
    let authSessionId = uniqueId('auth-session');
    let logIn = () =>
      consumerAuthService.authenticateWithUserAuthSession({
        consumerSurface: surface,
        context: testContext(),
        user,
        authSessionId
      });

    let first = await logIn();
    expect(first).toMatchObject({ consumerProfileOid: profile.oid, authSessionId });
    expect(first.expiresAt.getTime()).toBeGreaterThan(addDays(new Date(), 300).getTime());

    let second = await logIn();
    expect(second).toMatchObject({ id: first.id, tokenNonce: first.tokenNonce });

    let firstToken = await consumerAuthService.getConsumerSessionToken({
      session: first,
      surface
    });
    await consumerAuthService.revokeConsumerSession({
      session: first,
      auditScope: fixture.auditScope
    });

    let renewed = await logIn();
    expect(renewed.id).toBe(first.id);
    expect(renewed.loggedOutAt).toBeNull();
    expect(renewed.tokenNonce).not.toBe(first.tokenNonce);

    await expectServiceError(authenticate(firstToken, surface), 'unauthorized');
    let renewedToken = await consumerAuthService.getConsumerSessionToken({
      session: renewed,
      surface
    });
    expect((await authenticate(renewedToken, surface)).id).toBe(first.id);

    expect(
      await db.consumerSession.count({ where: { consumerProfileOid: profile.oid } })
    ).toBe(1);
  });

  it('rejects a user whose profile belongs to a different surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let user = await signUpUser();
    await createConsumerProfile(fixture, await createConsumerSurface(fixture), {
      email: user.email
    });

    await expectServiceError(
      consumerAuthService.authenticateWithUserAuthSession({
        consumerSurface: surface,
        context: testContext(),
        user,
        authSessionId: uniqueId('auth-session')
      }),
      'not_found'
    );
  });

  it('derives the access tags of a session from its effective groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let assigned = await createConsumerGroup(fixture, surface);
    let unassigned = await createConsumerGroup(fixture, surface);
    let everyone = await db.consumerGroup.findFirstOrThrow({
      where: { surfaceOid: surface.oid, isDefaultEveryoneGroup: true }
    });

    await consumerProfileService.assignToGroups({
      consumerProfile: profile,
      groupIds: [assigned.id],
      auditScope: fixture.auditScope
    });

    let { token } = await startSession(surface, profile);
    let context = await consumerAuthService.getConsumerAccessContextForSession({
      session: await authenticate(token, surface)
    });

    expect(context.accessTags.map(String).sort()).toEqual(
      [profile.personalConsumerGroup, everyone, assigned]
        .map(group => String(group.accessTagOid))
        .sort()
    );
    expect(context.accessTags).not.toContain(unassigned.accessTagOid);
  });
});
