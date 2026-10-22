import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerOAuthRegistrationService } from '../src';
import {
  authorize,
  createPortal,
  createSetup,
  expectOAuthError,
  randomIp,
  redirectUri,
  registerClient
} from './_fixtures';

describe('module-consumer-oauth client registration', () => {
  let org = useOrganization();
  let limitedOrg = useOrganization();

  it('registers public and confidential clients with normalized metadata', async () => {
    let setup = await createSetup(org.ids);
    let clientName = uniqueId('Normalized Client');

    let publicClient = await registerClient(setup, {
      clientName,
      redirectUris: ['http://localhost:43111/b', 'http://localhost:43111/a'],
      clientUri: '  https://client.example.com/app  ',
      logoUri: 'https://client.example.com/logo.png'
    });
    expect(publicClient).toMatchObject({
      name: clientName,
      tokenEndpointAuthMethod: 'none',
      clientSecret: null,
      redirectUris: ['http://localhost:43111/a', 'http://localhost:43111/b'],
      clientUri: 'https://client.example.com/app',
      logoUri: 'https://client.example.com/logo.png',
      tosUri: null,
      policyUri: null,
      instanceOid: setup.fixture.instance.oid,
      organizationOid: setup.fixture.organization.oid,
      magicMcpServerOid: setup.magicMcpTarget.target.oid,
      magicMcpEndpointOid: null,
      skillPluginOid: null
    });
    expect(publicClient.clientId).toBeTruthy();
    expect(publicClient.expiresAt.getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
    expect(publicClient.consumerAuthClientSurfaces.map(ref => ref.consumerSurface.id)).toEqual(
      [setup.portal.surface.id]
    );

    let confidential = await registerClient(setup, {
      clientName,
      redirectUris: ['http://localhost:43111/a', 'http://localhost:43111/b'],
      tokenEndpointAuthMethod: undefined
    });
    expect(confidential.tokenEndpointAuthMethod).toBe('client_secret_basic');
    expect(confidential.clientSecret).toEqual(expect.any(String));
    expect(confidential.clientSecret).not.toBe(confidential.clientId);
    expect(confidential.clientId).not.toBe(publicClient.clientId);

    let consumerClients = await db.consumerClient.findMany({
      where: { consumerSurfaceOid: setup.portal.surface.oid, name: clientName }
    });
    expect(consumerClients).toHaveLength(1);
    expect(confidential.consumerAuthClientSurfaces.map(ref => ref.consumerClientOid)).toEqual([
      consumerClients[0]!.oid
    ]);
  });

  it('rejects malformed and blocked redirect URIs without storing a client', async () => {
    let setup = await createSetup(org.ids);
    let clientName = uniqueId('Rejected Client');

    await expectOAuthError(
      registerClient(setup, { clientName, redirectUris: ['not a url'] }),
      'bad_request',
      'invalid_request',
      /must be a valid URL/
    );

    for (let blocked of [
      'ftp://example.com/callback',
      'file:///etc/passwd',
      'data:text/html,hello',
      'ws://localhost:43111/callback',
      'ssh://example.com'
    ]) {
      await expectOAuthError(
        registerClient(setup, { clientName, redirectUris: [redirectUri, blocked] }),
        'bad_request',
        'invalid_request',
        /blocked redirect protocol/
      );
    }

    await expectOAuthError(
      registerClient(setup, {
        clientName,
        redirectUris: ['http://evil.example.com/callback']
      }),
      'bad_request',
      'invalid_request',
      /not allowed for this portal/
    );

    expect(await db.consumerAuthClient.count({ where: { name: clientName } })).toBe(0);
  });

  it('rejects script redirect URIs', async () => {
    let setup = await createSetup(org.ids);

    for (let scriptUri of ['javascript:alert(document.cookie)//', 'vbscript:msgbox(1)']) {
      await expectServiceError(
        registerClient(setup, { redirectUris: [scriptUri] }),
        'bad_request'
      );
    }
  });

  it('enforces the portal redirect allowlist on registration and authorization', async () => {
    let setup = await createSetup(org.ids, {
      allowedRedirectUrlFilters: [{ url: 'https://app.example.com/*' }]
    });

    await expectOAuthError(
      registerClient(setup, { redirectUris: [redirectUri] }),
      'bad_request',
      'invalid_request',
      /not allowed for this portal/
    );

    let client = await registerClient(setup, {
      redirectUris: ['https://app.example.com/callback', 'https://other.example.com/callback']
    });
    expect(client.redirectUris).toEqual([
      'https://app.example.com/callback',
      'https://other.example.com/callback'
    ]);

    await expectOAuthError(
      authorize(setup, client, { redirectUri: 'https://other.example.com/callback' }),
      'bad_request',
      'invalid_request',
      /not allowed for this portal/
    );

    let { attempt } = await authorize(setup, client, {
      redirectUri: 'https://app.example.com/callback'
    });
    expect(attempt.redirectUri).toBe('https://app.example.com/callback');
  });

  it('rejects client metadata URLs that are not plain https URLs', async () => {
    let setup = await createSetup(org.ids);

    for (let input of [
      { logoUri: 'http://client.example.com/logo.png' },
      { clientUri: 'not a url' },
      { tosUri: 'https://user:pass@client.example.com/tos' },
      { policyUri: `https://client.example.com/${'a'.repeat(2100)}` }
    ]) {
      await expectOAuthError(
        registerClient(setup, input),
        'bad_request',
        'invalid_client_metadata',
        /must be a valid https URL/
      );
    }
  });

  it('rate limits registrations per IP address with the project limit', async () => {
    let setup = await createSetup(limitedOrg.ids);
    await db.project.update({
      where: { oid: setup.fixture.project.oid },
      data: { consumerAuthClientRegistrationsPerMinuteLimit: 2 }
    });
    let registrationIp = randomIp();

    await registerClient(setup, { registrationIp });
    await registerClient(setup, { registrationIp });

    let clientName = uniqueId('Limited Client');
    await expectServiceError(
      registerClient(setup, { registrationIp, clientName }),
      'rate_limit_exceeded'
    );
    expect(await db.consumerAuthClient.count({ where: { name: clientName } })).toBe(0);

    let otherIp = await registerClient(setup, { registrationIp: randomIp() });
    expect(otherIp.clientId).toBeTruthy();
  });

  it('looks registrations up only through their portal and magic MCP target', async () => {
    let setup = await createSetup(org.ids);
    let otherPortal = await createPortal(setup.fixture);
    let client = await registerClient(setup);

    let found = await consumerOAuthRegistrationService.getConsumerAuthRegistration({
      portal: setup.portal,
      magicMcpTarget: setup.magicMcpTarget,
      registrationId: client.id
    });
    expect(found?.clientId).toBe(client.clientId);

    expect(
      await consumerOAuthRegistrationService.getConsumerAuthRegistration({
        portal: otherPortal,
        magicMcpTarget: setup.magicMcpTarget,
        registrationId: client.id
      })
    ).toBeNull();
    expect(
      await consumerOAuthRegistrationService.getConsumerAuthRegistration({
        portal: setup.portal,
        magicMcpTarget: null,
        registrationId: client.id
      })
    ).toBeNull();

    await expectServiceError(
      consumerOAuthRegistrationService.registerConsumerAuthClient({
        magicMcpTarget: null,
        input: {
          clientName: uniqueId('Surfaceless Client'),
          redirectUris: [redirectUri],
          registrationIp: randomIp()
        }
      }),
      'not_found'
    );
  });
});
