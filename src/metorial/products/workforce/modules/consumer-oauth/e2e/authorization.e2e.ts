import { expectServiceError, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerOAuthDashboardService } from '../src';
import { buildConsumerOAuthCallbackRedirectUrl } from '../src/services/_helpers';
import {
  approve,
  authorize,
  createConsumerProfile,
  createPkce,
  createSetup,
  exchange,
  expectOAuthError,
  loadAuthorization,
  redirectUri,
  registerClient
} from './_fixtures';

describe('module-consumer-oauth authorization', () => {
  let org = useOrganization();

  it('creates a pending authorization bound to the client, redirect URI, state and challenge', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    let pkce = await createPkce();

    let { attempt, redirectUrl } = await authorize(setup, client, {
      state: 'e2e-state value',
      codeChallenge: pkce.codeChallenge,
      codeChallengeMethod: 'S256'
    });
    expect(attempt).toMatchObject({
      status: 'pending',
      redirectUri,
      state: 'e2e-state value',
      codeChallenge: pkce.codeChallenge,
      codeChallengeMethod: 's256',
      consumerAuthClientOid: client.oid,
      consumerProfileOid: null,
      authorizationCodeExpiresAt: null,
      authorizationCodeUsedAt: null,
      refreshToken: null,
      magicMcpTokenOid: null
    });
    expect(attempt.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    let url = new URL(redirectUrl);
    expect(url.pathname).toMatch(new RegExp(`/oauth/authorize/${attempt.id}$`));
    expect(url.search).toBe('');
    expect(redirectUrl).not.toContain(attempt.authorizationCode!);

    let stored = await db.consumerAuthAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(stored.status).toBe('pending');
  });

  it('rejects invalid authorization requests without creating attempts', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    let countAttempts = () =>
      db.consumerAuthAttempt.count({ where: { consumerAuthClientOid: client.oid } });

    await expectOAuthError(
      authorize(setup, client, { responseType: undefined }),
      'bad_request',
      'invalid_request',
      /response_type is required/
    );
    await expectOAuthError(
      authorize(setup, client, { responseType: 'token' }),
      'bad_request',
      'unsupported_response_type'
    );
    await expectOAuthError(
      authorize(setup, { clientId: '' }),
      'bad_request',
      'invalid_request',
      /client_id is required/
    );
    await expectOAuthError(
      authorize(setup, client, { redirectUri: undefined }),
      'bad_request',
      'invalid_request',
      /redirect_uri is required/
    );
    await expectOAuthError(
      authorize(setup, client, { codeChallenge: 'challenge', codeChallengeMethod: 'plain' }),
      'bad_request',
      'invalid_request',
      /Only S256/
    );
    await expectOAuthError(
      authorize(setup, client, { codeChallengeMethod: 'S256' }),
      'bad_request',
      'invalid_request',
      /code_challenge is required/
    );
    await expectOAuthError(
      authorize(setup, { clientId: 'unknown-client-id' }),
      'unauthorized',
      'invalid_client'
    );

    for (let unregistered of [
      'http://localhost:43111/other',
      'http://localhost:43112/callback',
      'https://localhost:43111/callback'
    ]) {
      await expectOAuthError(
        authorize(setup, client, { redirectUri: unregistered }),
        'bad_request',
        'invalid_request',
        /Invalid redirect URI/
      );
    }

    expect(await countAttempts()).toBe(0);
  });

  it('normalizes PKCE methods and treats loopback hosts as equivalent', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    let pkce = await createPkce();

    let inferred = await authorize(setup, client, { codeChallenge: pkce.codeChallenge });
    expect(inferred.attempt.codeChallengeMethod).toBe('s256');

    let lowercase = await authorize(setup, client, {
      codeChallenge: pkce.codeChallenge,
      codeChallengeMethod: 's256'
    });
    expect(lowercase.attempt.codeChallengeMethod).toBe('s256');

    let none = await authorize(setup, client, { codeChallengeMethod: 'none' });
    expect(none.attempt).toMatchObject({ codeChallengeMethod: 'none', codeChallenge: null });

    let loopback = await authorize(setup, client, {
      redirectUri: 'http://127.0.0.1:43111/callback'
    });
    expect(loopback.attempt.redirectUri).toBe('http://127.0.0.1:43111/callback');
  });

  it('rejects clients whose registration has expired', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    await db.consumerAuthClient.update({
      where: { oid: client.oid },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    await expectOAuthError(authorize(setup, client), 'unauthorized', 'invalid_client');
  });

  it('approves an authorization for one consumer and issues a short-lived code', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    let { attempt } = await authorize(setup, client, { state: 'approve-state' });
    let consumerProfile = await createConsumerProfile(setup);

    let approved = await approve(setup, consumerProfile, attempt.id);
    expect(approved).toMatchObject({
      status: 'authorized',
      consumerProfileOid: consumerProfile.oid,
      authorizationCode: attempt.authorizationCode,
      deniedAt: null
    });
    expect(approved.authorizedAt).toBeInstanceOf(Date);
    expect(approved.authorizationCodeExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(approved.authorizationCodeExpiresAt!.getTime()).toBeLessThanOrEqual(
      Date.now() + 10 * 60_000
    );

    let callback = new URL(
      buildConsumerOAuthCallbackRedirectUrl({
        redirectUri: approved.redirectUri,
        state: approved.state,
        status: approved.status,
        authorizationCode: approved.authorizationCode
      })!
    );
    expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri);
    expect(callback.searchParams.get('code')).toBe(attempt.authorizationCode);
    expect(callback.searchParams.get('state')).toBe('approve-state');
    expect(callback.searchParams.get('error')).toBeNull();

    let reloaded = await loadAuthorization(setup, consumerProfile, attempt.id);
    await expectServiceError(
      consumerOAuthDashboardService.acceptConsumerAuthAuthorization({
        portalOAuthAuthorization: reloaded,
        consumerProfile
      }),
      'precondition_failed'
    );
    await expectServiceError(
      consumerOAuthDashboardService.rejectConsumerAuthAuthorization({
        portalOAuthAuthorization: reloaded,
        consumerProfile
      }),
      'precondition_failed'
    );

    let otherConsumer = await createConsumerProfile(setup);
    await expectServiceError(
      loadAuthorization(setup, otherConsumer, attempt.id),
      'precondition_failed'
    );
  });

  it('denies an authorization, redirects with access_denied and state, and voids the code', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    let pkce = await createPkce();
    let { attempt } = await authorize(setup, client, {
      state: 'deny-state',
      codeChallenge: pkce.codeChallenge
    });
    let consumerProfile = await createConsumerProfile(setup);

    let denied = await consumerOAuthDashboardService.rejectConsumerAuthAuthorization({
      portalOAuthAuthorization: await loadAuthorization(setup, consumerProfile, attempt.id),
      consumerProfile
    });
    expect(denied).toMatchObject({
      status: 'denied',
      consumerProfileOid: consumerProfile.oid
    });
    expect(denied.deniedAt).toBeInstanceOf(Date);

    let callback = new URL(
      buildConsumerOAuthCallbackRedirectUrl({
        redirectUri: denied.redirectUri,
        state: denied.state,
        status: denied.status,
        authorizationCode: denied.authorizationCode
      })!
    );
    expect(callback.searchParams.get('error')).toBe('access_denied');
    expect(callback.searchParams.get('state')).toBe('deny-state');
    expect(callback.searchParams.get('code')).toBeNull();

    await expectOAuthError(
      exchange(setup, {
        grantType: 'authorization_code',
        clientId: client.clientId,
        code: attempt.authorizationCode!,
        redirectUri,
        codeVerifier: pkce.codeVerifier
      }),
      'bad_request',
      'invalid_grant',
      /Invalid authorization code/
    );

    await expectServiceError(
      approve(setup, consumerProfile, attempt.id),
      'precondition_failed'
    );
    expect(
      (await db.consumerAuthAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status
    ).toBe('denied');
  });

  it('does not issue codes for pending authorizations', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);
    let { attempt } = await authorize(setup, client);

    expect(
      buildConsumerOAuthCallbackRedirectUrl({
        redirectUri: attempt.redirectUri,
        state: attempt.state,
        status: attempt.status,
        authorizationCode: attempt.authorizationCode
      })
    ).toBeNull();

    await expectOAuthError(
      exchange(setup, {
        grantType: 'authorization_code',
        clientId: client.clientId,
        code: attempt.authorizationCode!,
        redirectUri
      }),
      'bad_request',
      'invalid_grant',
      /Invalid authorization code/
    );
  });

  it('requires a magic MCP target before an authorization can be approved', async () => {
    let setup = await createSetup(org.ids);
    let untargeted = { portal: setup.portal, magicMcpTarget: null };
    let client = await registerClient(untargeted);
    let { attempt } = await authorize(untargeted, client);
    let consumerProfile = await createConsumerProfile(setup);

    await expectServiceError(
      approve(setup, consumerProfile, attempt.id),
      'precondition_failed'
    );
    expect(
      (await db.consumerAuthAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status
    ).toBe('pending');
  });
});
