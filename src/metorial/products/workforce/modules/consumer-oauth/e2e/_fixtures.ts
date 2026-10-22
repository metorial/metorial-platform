import { base64UrlEncode, createCodeChallenge } from '@metorial/consumer-oauth-utils';
import type { ConsumerProfile } from '@metorial/db';
import { expectServiceError, uniqueEmail, uniqueId } from '@metorial/e2e';
import { loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { consumerProfileService } from '@metorial/module-consumer-core';
import {
  magicMcpServerService,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias,
  type MagicMcpResolvedTarget
} from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { expect } from 'vitest';
import {
  consumerOAuthAuthorizationService,
  consumerOAuthDashboardService,
  consumerOAuthRegistrationService,
  consumerOAuthTokenService
} from '../src';

export let redirectUri = 'http://localhost:43111/callback';

export type ConsumerOAuthPortal = Awaited<ReturnType<typeof portalService.getPortalPublic>>;

export type ConsumerOAuthRoute = {
  portal: ConsumerOAuthPortal;
  magicMcpTarget: MagicMcpResolvedTarget | null;
};

export type ConsumerOAuthSetup = {
  fixture: OrganizationFixture;
  portal: ConsumerOAuthPortal;
  magicMcpTarget: MagicMcpResolvedTarget;
};

type RegistrationInput = Parameters<
  typeof consumerOAuthRegistrationService.registerConsumerAuthClient
>[0]['input'];

type AuthorizationInput = Parameters<
  typeof consumerOAuthAuthorizationService.createConsumerAuthAuthorization
>[0]['input'];

type TokenInput = Parameters<
  typeof consumerOAuthTokenService.exchangeConsumerAuthToken
>[0]['input'];

export type ConsumerOAuthClient = Awaited<
  ReturnType<typeof consumerOAuthRegistrationService.registerConsumerAuthClient>
>;

export let randomIp = () =>
  `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join('.')}`;

export let createPortal = async (
  fixture: OrganizationFixture,
  input: { allowedRedirectUrlFilters?: { url: string }[] } = {}
) => {
  let created = await portalService.createPortal({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('OAuth Portal'), ...input }
  });

  return await portalService.getPortalPublic({ portalId: created.id });
};

export let createMagicMcpTarget = async (fixture: OrganizationFixture) => {
  let server = await magicMcpServerService.createMagicMcpServer({
    organization: fixture.organization,
    performedBy: fixture.actor,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('OAuth Magic Server') }
  });

  return await resolveMagicMcpTargetByIdOrAlias(server.id);
};

export let createSetup = async (
  ids: { organizationId: string },
  input: { allowedRedirectUrlFilters?: { url: string }[] } = {}
): Promise<ConsumerOAuthSetup> => {
  let fixture = await loadOrganizationFixture(ids);
  let portal = await createPortal(fixture, input);
  let magicMcpTarget = await createMagicMcpTarget(fixture);

  return { fixture, portal, magicMcpTarget };
};

export let createPkce = async () => {
  let codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));

  return { codeVerifier, codeChallenge: await createCodeChallenge(codeVerifier) };
};

export let registerClient = (
  route: ConsumerOAuthRoute,
  input: Partial<RegistrationInput> = {}
) =>
  consumerOAuthRegistrationService.registerConsumerAuthClient({
    portal: route.portal,
    magicMcpTarget: route.magicMcpTarget,
    input: {
      clientName: uniqueId('E2E OAuth Client'),
      redirectUris: [redirectUri],
      registrationIp: randomIp(),
      tokenEndpointAuthMethod: 'none',
      ...input
    }
  });

export let authorize = (
  route: ConsumerOAuthRoute,
  client: { clientId: string },
  input: Partial<AuthorizationInput> = {}
) =>
  consumerOAuthAuthorizationService.createConsumerAuthAuthorization({
    portal: route.portal,
    magicMcpTarget: route.magicMcpTarget,
    input: {
      responseType: 'code',
      clientId: client.clientId,
      redirectUri,
      state: uniqueId('state'),
      ...input
    }
  });

export let createConsumerProfile = (setup: ConsumerOAuthSetup) =>
  consumerProfileService.createConsumerProfile({
    surface: setup.portal.surface,
    email: uniqueEmail('oauth'),
    name: 'E2E OAuth Consumer',
    auditScope: setup.fixture.auditScope
  });

export let loadAuthorization = (
  setup: ConsumerOAuthSetup,
  consumerProfile: ConsumerProfile,
  attemptId: string
) =>
  consumerOAuthDashboardService.getConsumerAuthAuthorizationForConsumer({
    instance: setup.fixture.instance,
    project: setup.fixture.project,
    consumerSurface: setup.portal.surface,
    consumerProfile,
    portalAuthAttemptId: attemptId
  });

export let approve = async (
  setup: ConsumerOAuthSetup,
  consumerProfile: ConsumerProfile,
  attemptId: string
) =>
  await consumerOAuthDashboardService.acceptConsumerAuthAuthorization({
    portalOAuthAuthorization: await loadAuthorization(setup, consumerProfile, attemptId),
    consumerProfile
  });

export let exchange = (route: ConsumerOAuthRoute, input: TokenInput) =>
  consumerOAuthTokenService.exchangeConsumerAuthToken({
    portal: route.portal,
    magicMcpTarget: route.magicMcpTarget,
    input
  });

export let createApprovedAuthorization = async (
  setup: ConsumerOAuthSetup,
  client?: ConsumerOAuthClient
) => {
  client ??= await registerClient(setup);
  let pkce = await createPkce();

  let { attempt } = await authorize(setup, client, {
    codeChallenge: pkce.codeChallenge,
    codeChallengeMethod: 'S256'
  });
  let consumerProfile = await createConsumerProfile(setup);
  let approved = await approve(setup, consumerProfile, attempt.id);

  return {
    client,
    pkce,
    attempt,
    consumerProfile,
    code: approved.authorizationCode!,
    codeGrant: {
      grantType: 'authorization_code',
      clientId: client.clientId,
      code: approved.authorizationCode!,
      redirectUri,
      codeVerifier: pkce.codeVerifier
    } satisfies TokenInput
  };
};

export let issueTokens = async (setup: ConsumerOAuthSetup, client?: ConsumerOAuthClient) => {
  let approved = await createApprovedAuthorization(setup, client);
  let tokens = await exchange(setup, approved.codeGrant);

  return { ...approved, tokens };
};

export let findAccessToken = (setup: ConsumerOAuthSetup, secret: string) =>
  magicMcpTokenService.getMagicMcpTokenBySecretSafe({
    instance: setup.fixture.instance,
    secret
  });

export let expectOAuthError = async (
  promise: Promise<unknown>,
  code: string,
  oauthError: string,
  message?: RegExp
) => {
  let data = await expectServiceError(promise, code);
  expect((data as { oauth?: { error?: string } }).oauth?.error).toBe(oauthError);
  if (message) expect(data.message).toMatch(message);

  return data;
};
