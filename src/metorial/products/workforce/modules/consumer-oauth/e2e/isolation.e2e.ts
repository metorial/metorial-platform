import { expectServiceError, useOrganization } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  consumerOAuthClientService,
  consumerOAuthDashboardService,
  consumerOAuthRegistrationService,
  consumerOAuthRoutingService
} from '../src';
import {
  authorize,
  createApprovedAuthorization,
  createConsumerProfile,
  createMagicMcpTarget,
  createPortal,
  createSetup,
  exchange,
  expectOAuthError,
  findAccessToken,
  issueTokens,
  registerClient
} from './_fixtures';

describe('module-consumer-oauth tenant isolation and routing', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('does not resolve clients through another portal or organization', async () => {
    let setup = await createSetup(org.ids);
    let samePortalOrg = {
      portal: await createPortal(setup.fixture),
      magicMcpTarget: setup.magicMcpTarget
    };
    let other = await createSetup(otherOrg.ids);
    let client = await registerClient(setup);

    for (let route of [samePortalOrg, other]) {
      await expectOAuthError(authorize(route, client), 'unauthorized', 'invalid_client');
    }

    await expectServiceError(
      consumerOAuthDashboardService.getConsumerAuthClientForConsumer({
        instance: other.fixture.instance,
        consumerSurface: other.portal.surface,
        portalAuthClientId: client.id
      }),
      'not_found'
    );
    await expectServiceError(
      consumerOAuthDashboardService.getConsumerAuthClientForConsumer({
        instance: setup.fixture.instance,
        consumerSurface: samePortalOrg.portal.surface,
        portalAuthClientId: client.id
      }),
      'not_found'
    );
    expect(
      await consumerOAuthRegistrationService.getConsumerAuthRegistration({
        portal: other.portal,
        magicMcpTarget: other.magicMcpTarget,
        registrationId: client.id
      })
    ).toBeNull();
  });

  it('does not exchange codes or refresh tokens through another tenant', async () => {
    let setup = await createSetup(org.ids);
    let other = await createSetup(otherOrg.ids);
    let otherClient = await registerClient(other);

    let { codeGrant } = await createApprovedAuthorization(setup);
    await expectOAuthError(exchange(other, codeGrant), 'unauthorized', 'invalid_client');
    await expectOAuthError(
      exchange(other, { ...codeGrant, clientId: otherClient.clientId }),
      'bad_request',
      'invalid_grant'
    );

    let { client, tokens } = await issueTokens(setup);
    let refreshGrant = {
      grantType: 'refresh_token',
      clientId: client.clientId,
      refreshToken: tokens.refreshToken
    };
    await expectOAuthError(exchange(other, refreshGrant), 'unauthorized', 'invalid_client');
    await expectOAuthError(
      exchange(other, { ...refreshGrant, clientId: otherClient.clientId }),
      'bad_request',
      'invalid_grant'
    );

    expect(
      await findAccessToken({ ...setup, fixture: other.fixture }, tokens.accessToken)
    ).toBeNull();
    expect(await findAccessToken(setup, tokens.accessToken)).not.toBeNull();

    let refreshed = await exchange(setup, refreshGrant);
    expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);
  });

  it('scopes clients to the magic MCP target they were registered for', async () => {
    let setup = await createSetup(org.ids);
    let otherTarget = {
      portal: setup.portal,
      magicMcpTarget: await createMagicMcpTarget(setup.fixture)
    };
    let untargeted = { portal: setup.portal, magicMcpTarget: null };
    let client = await registerClient(setup);

    for (let route of [otherTarget, untargeted]) {
      await expectOAuthError(authorize(route, client), 'unauthorized', 'invalid_client');
    }

    let { codeGrant } = await createApprovedAuthorization(setup, client);
    for (let route of [otherTarget, untargeted]) {
      await expectOAuthError(exchange(route, codeGrant), 'unauthorized', 'invalid_client');
    }

    let tokens = await exchange(setup, codeGrant);
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  it('hides authorizations from other instances and consumer surfaces', async () => {
    let setup = await createSetup(org.ids);
    let other = await createSetup(otherOrg.ids);
    let client = await registerClient(setup);
    let { attempt } = await authorize(setup, client);
    let otherConsumer = await createConsumerProfile(other);

    await expectServiceError(
      consumerOAuthDashboardService.getConsumerAuthAuthorizationForConsumer({
        instance: other.fixture.instance,
        project: other.fixture.project,
        consumerSurface: other.portal.surface,
        consumerProfile: otherConsumer,
        portalAuthAttemptId: attempt.id
      }),
      'not_found'
    );

    let otherPortal = await createPortal(setup.fixture);
    await expectServiceError(
      consumerOAuthDashboardService.getConsumerAuthAuthorizationForConsumer({
        instance: setup.fixture.instance,
        project: setup.fixture.project,
        consumerSurface: otherPortal.surface,
        consumerProfile: await createConsumerProfile(setup),
        portalAuthAttemptId: attempt.id
      }),
      'not_found'
    );
  });

  it('refuses to attach a client to a consumer surface of another instance', async () => {
    let setup = await createSetup(org.ids);
    let other = await createSetup(otherOrg.ids);
    let client = await registerClient(setup);

    await expectServiceError(
      consumerOAuthClientService.ensureConsumerAuthClientSurface({
        consumerAuthClient: client,
        consumerSurface: other.portal.surface
      }),
      'precondition_failed'
    );
    await expectOAuthError(authorize(other, client), 'unauthorized', 'invalid_client');
  });

  it('resolves portal routes with their magic MCP target and rejects foreign targets', async () => {
    let setup = await createSetup(org.ids);
    let other = await createSetup(otherOrg.ids);

    let route = await consumerOAuthRoutingService.resolvePortalRoute({
      portalId: setup.portal.id,
      magicMcpTargetId: setup.magicMcpTarget.target.id
    });
    expect(route.portal?.id).toBe(setup.portal.id);
    expect(route.instanceOid).toBe(setup.fixture.instance.oid);
    expect(route.magicMcpTarget?.target.id).toBe(setup.magicMcpTarget.target.id);
    expect(route.base).toMatch(
      new RegExp(`/connect/portal/${setup.portal.id}/${setup.magicMcpTarget.target.id}$`)
    );

    let mcpRoute = await consumerOAuthRoutingService.resolvePortalMcpRoute({
      portalId: setup.portal.slug,
      magicMcpTargetId: setup.magicMcpTarget.target.id
    });
    expect(mcpRoute.instanceOid).toBe(setup.fixture.instance.oid);
    expect(mcpRoute.magicMcpTarget?.target.id).toBe(setup.magicMcpTarget.target.id);

    let resolvers = [
      (d: { portalId: string; magicMcpTargetId: string }) =>
        consumerOAuthRoutingService.resolvePortalRoute(d),
      (d: { portalId: string; magicMcpTargetId: string }) =>
        consumerOAuthRoutingService.resolvePortalMcpRoute(d)
    ];

    for (let resolve of resolvers) {
      await expectServiceError(
        resolve({
          portalId: setup.portal.id,
          magicMcpTargetId: other.magicMcpTarget.target.id
        }),
        'not_found'
      );
      await expectServiceError(
        resolve({ portalId: setup.portal.id, magicMcpTargetId: 'missing-magic-target' }),
        'not_found'
      );
    }

    await expectServiceError(
      consumerOAuthRoutingService.resolvePortalRoute({
        portalId: setup.portal.id,
        namespaceHost: 'unknown.e2e.metorial.test'
      }),
      'not_found'
    );
  });
});
