import { expectServiceError, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { magicMcpTokenService } from '@metorial/module-magic';
import { describe, expect, it } from 'vitest';
import {
  approve,
  authorize,
  createApprovedAuthorization,
  createConsumerProfile,
  createPkce,
  createSetup,
  exchange,
  expectOAuthError,
  findAccessToken,
  issueTokens,
  redirectUri,
  registerClient,
  registerLegacyClient
} from './_fixtures';

describe('module-consumer-oauth token exchange', () => {
  let org = useOrganization();

  it('exchanges an approved code once for an access token that authenticates', async () => {
    let setup = await createSetup(org.ids);
    let { client, attempt, codeGrant, tokens } = await issueTokens(setup);

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toMatch(/^prtl_oatre_/);
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);

    let accessToken = await findAccessToken(setup, tokens.accessToken);
    expect(accessToken).toMatchObject({
      status: 'active',
      instanceOid: setup.fixture.instance.oid,
      magicMcpServerOid: setup.magicMcpTarget.target.oid,
      name: client.name
    });
    expect(accessToken!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    let stored = await db.consumerAuthAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(stored).toMatchObject({
      status: 'active',
      refreshToken: tokens.refreshToken,
      magicMcpTokenOid: accessToken!.oid
    });
    expect(stored.authorizationCodeUsedAt).toBeInstanceOf(Date);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    await expectOAuthError(
      exchange(setup, codeGrant),
      'bad_request',
      'invalid_grant',
      /Invalid authorization code/
    );
    expect(await db.magicMcpToken.count({ where: { name: client.name } })).toBe(1);
  });

  it('redeems a code only once when it is exchanged concurrently', async () => {
    let setup = await createSetup(org.ids);
    let { client, codeGrant } = await createApprovedAuthorization(setup);

    let results = await Promise.allSettled([
      exchange(setup, codeGrant),
      exchange(setup, codeGrant),
      exchange(setup, codeGrant)
    ]);

    expect(results.filter(result => result.status == 'fulfilled')).toHaveLength(1);
    expect(await db.magicMcpToken.count({ where: { name: client.name } })).toBe(1);
  });

  it('verifies the PKCE code verifier', async () => {
    let setup = await createSetup(org.ids);
    let { codeGrant } = await createApprovedAuthorization(setup);
    let other = await createPkce();

    await expectOAuthError(
      exchange(setup, { ...codeGrant, codeVerifier: undefined }),
      'bad_request',
      'invalid_grant',
      /code verifier is required/
    );
    await expectOAuthError(
      exchange(setup, { ...codeGrant, codeVerifier: other.codeVerifier }),
      'bad_request',
      'invalid_grant',
      /Invalid PKCE code verifier/
    );
    await expectOAuthError(
      exchange(setup, { ...codeGrant, codeVerifier: codeGrant.codeVerifier.toUpperCase() }),
      'bad_request',
      'invalid_grant',
      /Invalid PKCE code verifier/
    );

    let tokens = await exchange(setup, codeGrant);
    expect(tokens.refreshToken).toMatch(/^prtl_oatre_/);
  });

  it('rejects a code verifier for authorizations without a challenge', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerLegacyClient(setup);
    let { attempt } = await authorize(setup, client);
    let consumerProfile = await createConsumerProfile(setup);
    await approve(setup, consumerProfile, attempt.id);
    let pkce = await createPkce();

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
      /not allowed/
    );
  });

  it('requires PKCE for public clients', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup, { tokenEndpointAuthMethod: 'none' });
    expect(client.requirePkce).toBe(true);

    await expectOAuthError(
      authorize(setup, client),
      'bad_request',
      'invalid_request',
      /code_challenge is required for public clients/
    );
    await expectOAuthError(
      authorize(setup, client, { codeChallengeMethod: 'none' }),
      'bad_request',
      'invalid_request',
      /code_challenge is required for public clients/
    );
    expect(
      await db.consumerAuthAttempt.count({ where: { consumerAuthClientOid: client.oid } })
    ).toBe(0);

    let { attempt, codeGrant } = await createApprovedAuthorization(setup, client);
    await expectOAuthError(
      exchange(setup, { ...codeGrant, codeVerifier: undefined }),
      'bad_request',
      'invalid_grant',
      /code verifier is required/
    );

    await db.consumerAuthAttempt.update({
      where: { id: attempt.id },
      data: { codeChallengeMethod: 'none', codeChallenge: null }
    });
    await expectOAuthError(
      exchange(setup, { ...codeGrant, codeVerifier: undefined }),
      'bad_request',
      'invalid_grant',
      /not protected with PKCE/
    );
  });

  it('keeps PKCE optional for confidential clients', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup, {
      tokenEndpointAuthMethod: 'client_secret_post'
    });
    expect(client.requirePkce).toBe(true);

    let { attempt } = await authorize(setup, client);
    expect(attempt.codeChallengeMethod).toBe('none');
    let consumerProfile = await createConsumerProfile(setup);
    await approve(setup, consumerProfile, attempt.id);

    let tokens = await exchange(setup, {
      grantType: 'authorization_code',
      clientId: client.clientId,
      clientSecret: client.clientSecret!,
      code: attempt.authorizationCode!,
      redirectUri
    });
    expect(tokens.refreshToken).toMatch(/^prtl_oatre_/);
  });

  it('keeps PKCE optional for public clients registered before it was required', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerLegacyClient(setup);

    let { attempt } = await authorize(setup, client);
    expect(attempt).toMatchObject({ codeChallengeMethod: 'none', codeChallenge: null });
    let consumerProfile = await createConsumerProfile(setup);
    await approve(setup, consumerProfile, attempt.id);

    let tokens = await exchange(setup, {
      grantType: 'authorization_code',
      clientId: client.clientId,
      code: attempt.authorizationCode!,
      redirectUri
    });
    expect(tokens.refreshToken).toMatch(/^prtl_oatre_/);
    expect(await findAccessToken(setup, tokens.accessToken)).not.toBeNull();
  });

  it('binds the code to its client and redirect URI', async () => {
    let setup = await createSetup(org.ids);
    let { codeGrant } = await createApprovedAuthorization(setup);
    let otherClient = await registerClient(setup);

    await expectOAuthError(
      exchange(setup, { ...codeGrant, clientId: otherClient.clientId }),
      'bad_request',
      'invalid_grant',
      /Invalid authorization code/
    );
    await expectOAuthError(
      exchange(setup, { ...codeGrant, redirectUri: 'http://localhost:43111/other' }),
      'bad_request',
      'invalid_grant',
      /Redirect URI does not match/
    );
    await expectOAuthError(
      exchange(setup, { ...codeGrant, code: `${codeGrant.code}x` }),
      'bad_request',
      'invalid_grant'
    );

    let tokens = await exchange(setup, codeGrant);
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects expired codes and expired authorizations', async () => {
    let setup = await createSetup(org.ids);

    let expiredCode = await createApprovedAuthorization(setup);
    await db.consumerAuthAttempt.update({
      where: { id: expiredCode.attempt.id },
      data: { authorizationCodeExpiresAt: new Date(Date.now() - 1000) }
    });
    await expectOAuthError(
      exchange(setup, expiredCode.codeGrant),
      'bad_request',
      'invalid_grant',
      /Authorization code has expired/
    );

    let expiredAttempt = await createApprovedAuthorization(setup);
    await db.consumerAuthAttempt.update({
      where: { id: expiredAttempt.attempt.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    await expectOAuthError(
      exchange(setup, expiredAttempt.codeGrant),
      'bad_request',
      'invalid_grant',
      /authorization has expired/
    );

    expect(
      await db.consumerAuthAttempt.count({
        where: {
          id: { in: [expiredCode.attempt.id, expiredAttempt.attempt.id] },
          status: 'authorized'
        }
      })
    ).toBe(2);
  });

  it('authenticates confidential clients with their secret', async () => {
    let setup = await createSetup(org.ids);
    let confidential = await registerClient(setup, {
      tokenEndpointAuthMethod: 'client_secret_post'
    });
    let { codeGrant } = await createApprovedAuthorization(setup, confidential);

    await expectOAuthError(
      exchange(setup, codeGrant),
      'unauthorized',
      'invalid_client',
      /Invalid oauth client secret/
    );
    await expectOAuthError(
      exchange(setup, { ...codeGrant, clientSecret: `${confidential.clientSecret}x` }),
      'unauthorized',
      'invalid_client'
    );

    let tokens = await exchange(setup, {
      ...codeGrant,
      clientSecret: confidential.clientSecret!
    });
    expect(tokens.refreshToken).toMatch(/^prtl_oatre_/);

    await expectOAuthError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: confidential.clientId,
        refreshToken: tokens.refreshToken
      }),
      'unauthorized',
      'invalid_client'
    );

    let publicClient = await registerClient(setup);
    await expectOAuthError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: publicClient.clientId,
        clientSecret: confidential.clientSecret!,
        refreshToken: tokens.refreshToken
      }),
      'unauthorized',
      'invalid_client',
      /must not use a client secret/
    );
  });

  it('validates token requests', async () => {
    let setup = await createSetup(org.ids);
    let client = await registerClient(setup);

    await expectOAuthError(
      exchange(setup, { clientId: client.clientId }),
      'bad_request',
      'invalid_request',
      /grant_type is required/
    );
    await expectOAuthError(
      exchange(setup, { grantType: 'authorization_code' }),
      'bad_request',
      'invalid_request',
      /client_id is required/
    );
    await expectOAuthError(
      exchange(setup, { grantType: 'client_credentials', clientId: client.clientId }),
      'bad_request',
      'unsupported_grant_type'
    );
    await expectOAuthError(
      exchange(setup, {
        grantType: 'authorization_code',
        clientId: client.clientId,
        redirectUri
      }),
      'bad_request',
      'invalid_request',
      /code is required/
    );
    await expectOAuthError(
      exchange(setup, {
        grantType: 'authorization_code',
        clientId: client.clientId,
        code: 'x'
      }),
      'bad_request',
      'invalid_request',
      /redirect_uri is required/
    );
    await expectOAuthError(
      exchange(setup, { grantType: 'refresh_token', clientId: client.clientId }),
      'bad_request',
      'invalid_request',
      /refresh_token is required/
    );
    await expectOAuthError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: 'unknown-client-id',
        refreshToken: 'prtl_oatre_unknown'
      }),
      'unauthorized',
      'invalid_client'
    );
  });

  it('rotates the refresh token and the access token on refresh', async () => {
    let setup = await createSetup(org.ids);
    let { client, attempt, tokens } = await issueTokens(setup);
    let original = await findAccessToken(setup, tokens.accessToken);
    let refreshGrant = { grantType: 'refresh_token', clientId: client.clientId };

    let refreshed = await exchange(setup, {
      ...refreshGrant,
      refreshToken: tokens.refreshToken
    });
    expect(refreshed.accessToken).not.toBe(tokens.accessToken);
    expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);

    expect(await findAccessToken(setup, tokens.accessToken)).toBeNull();
    expect((await findAccessToken(setup, refreshed.accessToken))?.id).toBe(original!.id);
    expect(
      (await db.consumerAuthAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
        .refreshToken
    ).toBe(refreshed.refreshToken);

    await expectOAuthError(
      exchange(setup, { ...refreshGrant, refreshToken: tokens.refreshToken }),
      'bad_request',
      'invalid_grant',
      /Invalid refresh token/
    );

    let again = await exchange(setup, {
      ...refreshGrant,
      refreshToken: refreshed.refreshToken
    });
    expect(again.refreshToken).not.toBe(refreshed.refreshToken);
  });

  it('rejects refresh tokens presented by another client', async () => {
    let setup = await createSetup(org.ids);
    let { tokens } = await issueTokens(setup);
    let otherClient = await registerClient(setup);

    await expectOAuthError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: otherClient.clientId,
        refreshToken: tokens.refreshToken
      }),
      'bad_request',
      'invalid_grant',
      /Invalid refresh token/
    );
  });

  it('slides the client expiration when tokens are used', async () => {
    let setup = await createSetup(org.ids);
    let { client, tokens } = await issueTokens(setup);
    await db.consumerAuthClient.update({
      where: { oid: client.oid },
      data: { expiresAt: new Date(Date.now() + 60 * 60_000) }
    });

    await exchange(setup, {
      grantType: 'refresh_token',
      clientId: client.clientId,
      refreshToken: tokens.refreshToken
    });

    let stored = await db.consumerAuthClient.findUniqueOrThrow({ where: { oid: client.oid } });
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
  });

  it('stops refreshing once the access token is revoked or the authorization expired', async () => {
    let setup = await createSetup(org.ids);

    let revoked = await issueTokens(setup);
    let accessToken = await findAccessToken(setup, revoked.tokens.accessToken);
    await magicMcpTokenService.deleteMagicMcpToken({
      token: accessToken!,
      auditScope: setup.fixture.auditScope
    });
    expect(await findAccessToken(setup, revoked.tokens.accessToken)).toBeNull();
    await expectOAuthError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: revoked.client.clientId,
        refreshToken: revoked.tokens.refreshToken
      }),
      'bad_request',
      'invalid_grant',
      /no longer active/
    );

    let expired = await issueTokens(setup);
    await db.consumerAuthAttempt.update({
      where: { id: expired.attempt.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    await expectOAuthError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: expired.client.clientId,
        refreshToken: expired.tokens.refreshToken
      }),
      'bad_request',
      'invalid_grant',
      /authorization has expired/
    );
    expect(await findAccessToken(setup, expired.tokens.accessToken)).not.toBeNull();
  });

  it('rejects clients whose registration has expired', async () => {
    let setup = await createSetup(org.ids);
    let { client, tokens } = await issueTokens(setup);
    await db.consumerAuthClient.update({
      where: { oid: client.oid },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    await expectServiceError(
      exchange(setup, {
        grantType: 'refresh_token',
        clientId: client.clientId,
        refreshToken: tokens.refreshToken
      }),
      'unauthorized'
    );
  });
});
