import { rejectionOf, uniqueEmail, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { consumerProfileService } from '@metorial/module-consumer-core';
import { portalService } from '@metorial/module-portal';
import { describe, expect, it } from 'vitest';
import {
  consumerOAuthAuthorizationService,
  consumerOAuthDashboardService,
  consumerOAuthRegistrationService,
  consumerOAuthRoutingService,
  consumerOAuthTokenService
} from '../src';

let redirectUri = 'http://localhost:43111/callback';

let createPortal = async (fixture: OrganizationFixture) => {
  let created = await portalService.createPortal({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('OAuth Portal') }
  });

  return await portalService.getPortalPublic({ portalId: created.id });
};

let registerClient = async (portal: Awaited<ReturnType<typeof createPortal>>) =>
  await consumerOAuthRegistrationService.registerConsumerAuthClient({
    portal,
    magicMcpTarget: null,
    input: {
      clientName: uniqueId('E2E OAuth Client'),
      redirectUris: [redirectUri],
      registrationIp: '127.0.0.1',
      tokenEndpointAuthMethod: 'none'
    }
  });

describe('module-consumer-oauth', () => {
  let org = useOrganization();

  it('resolves portal routes by id and rejects unknown portals', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);

    let route = await consumerOAuthRoutingService.resolvePortalRoute({ portalId: portal.id });
    expect(route.portal?.id).toBe(portal.id);
    expect(route.consumerSurface).toBeNull();
    expect(route.instanceOid).toBe(fixture.instance.oid);
    expect(route.magicMcpTarget).toBeNull();
    expect(route.base).toMatch(new RegExp(`/connect/portal/${portal.id}$`));

    let bySurface = await consumerOAuthRoutingService.resolvePortalRoute({
      portalId: portal.surface.id,
      originOverride: 'https://portal.e2e.metorial.test'
    });
    expect(bySurface.portal).toBeNull();
    expect(bySurface.consumerSurface?.id).toBe(portal.surface.id);
    expect(bySurface.base).toBe(
      `https://portal.e2e.metorial.test/connect/portal/${portal.surface.id}`
    );

    let error = await rejectionOf(
      consumerOAuthRoutingService.resolvePortalRoute({ portalId: uniqueId('missing-portal') })
    );
    expect(error.data.code).toBe('not_found');
  });

  it('registers a public OAuth client for a portal and looks it up', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);

    let client = await registerClient(portal);
    expect(client.clientId).toBeTruthy();
    expect(client.clientSecret).toBeNull();
    expect(client.tokenEndpointAuthMethod).toBe('none');
    expect(client.redirectUris).toEqual([redirectUri]);
    expect(client.instanceOid).toBe(fixture.instance.oid);

    let registration = await consumerOAuthRegistrationService.getConsumerAuthRegistration({
      portal,
      magicMcpTarget: null,
      registrationId: client.id
    });
    expect(registration?.id).toBe(client.id);

    let missing = await consumerOAuthRegistrationService.getConsumerAuthRegistration({
      portal,
      magicMcpTarget: null,
      registrationId: uniqueId('missing-client')
    });
    expect(missing).toBeNull();

    let forConsumer = await consumerOAuthDashboardService.getConsumerAuthClientForConsumer({
      instance: fixture.instance,
      consumerSurface: portal.surface,
      portalAuthClientId: client.id
    });
    expect(forConsumer.id).toBe(client.id);

    let invalidRedirect = await rejectionOf(
      consumerOAuthRegistrationService.registerConsumerAuthClient({
        portal,
        magicMcpTarget: null,
        input: {
          clientName: uniqueId('E2E Bad Client'),
          redirectUris: ['ftp://example.com/callback'],
          registrationIp: '127.0.0.1'
        }
      })
    );
    expect(invalidRedirect.message).toMatch(/blocked redirect protocol/);
  });

  it('creates a pending authorization that a consumer can reject', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);
    let client = await registerClient(portal);

    let invalid = await rejectionOf(
      consumerOAuthAuthorizationService.createConsumerAuthAuthorization({
        portal,
        magicMcpTarget: null,
        input: { responseType: 'token', clientId: client.clientId, redirectUri }
      })
    );
    expect(invalid.message).toMatch(/response_type=code/);

    let { attempt, redirectUrl } =
      await consumerOAuthAuthorizationService.createConsumerAuthAuthorization({
        portal,
        magicMcpTarget: null,
        input: {
          responseType: 'code',
          clientId: client.clientId,
          redirectUri,
          codeChallenge: 'e2e-code-challenge-e2e-code-challenge-e2e-code',
          codeChallengeMethod: 'S256',
          state: 'e2e-state'
        }
      });
    expect(attempt.status).toBe('pending');
    expect(attempt.state).toBe('e2e-state');
    expect(attempt.codeChallengeMethod).toBe('s256');
    expect(redirectUrl).toContain(`/oauth/authorize/${attempt.id}`);

    let consumerProfile = await consumerProfileService.createConsumerProfile({
      surface: portal.surface,
      email: uniqueEmail('oauth'),
      name: 'E2E OAuth Consumer',
      auditScope: fixture.auditScope
    });

    let authorization =
      await consumerOAuthDashboardService.getConsumerAuthAuthorizationForConsumer({
        instance: fixture.instance,
        project: fixture.project,
        consumerSurface: portal.surface,
        consumerProfile,
        portalAuthAttemptId: attempt.id
      });
    expect(authorization.id).toBe(attempt.id);
    expect(authorization.skillPluginSupportedProviderIds).toEqual([]);

    let rejected = await consumerOAuthDashboardService.rejectConsumerAuthAuthorization({
      portalOAuthAuthorization: authorization,
      consumerProfile
    });
    expect(rejected.status).toBe('denied');
    expect(rejected.consumerProfileOid).toBe(consumerProfile.oid);

    await expect(
      consumerOAuthTokenService.exchangeConsumerAuthToken({
        portal,
        magicMcpTarget: null,
        input: {
          clientId: client.clientId,
          grantType: 'authorization_code',
          code: attempt.authorizationCode!,
          redirectUri,
          codeVerifier: 'e2e-code-verifier'
        }
      })
    ).rejects.toThrow();
  });
});
