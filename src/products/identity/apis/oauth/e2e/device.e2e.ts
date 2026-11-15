import { expectOk, metorialEndpoints, rest, useOrganization } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  acceptRequest,
  basicAuth,
  createApplication,
  expectOAuthError,
  type OAuthClient,
  postForm,
  postToken,
  rejectRequest
} from './_fixtures';

let deviceGrant = 'urn:ietf:params:oauth:grant-type:device_code';

let waitForNextPoll = () => new Promise(resolve => setTimeout(resolve, 4500));

let startDeviceAuthorization = async (client: OAuthClient, scope = 'organization:read') => {
  let response = await postForm(
    '/oauth/device_authorization',
    { scope },
    { authorization: basicAuth(client.clientId, client.clientSecret) }
  );
  if (response.status != 200) {
    throw new Error(
      `Device authorization failed (${response.status}): ${JSON.stringify(response.body)}`
    );
  }

  let urlToken = new URL(response.body.verification_uri).searchParams.get('token')!;

  return { ...response.body, urlToken };
};

describe('api-oauth device authorization', () => {
  let org = useOrganization();

  it('issues tokens once the device request is approved', async () => {
    let client = await createApplication(org.ids);
    let device = await startDeviceAuthorization(client);

    expect(device).toMatchObject({
      device_code: expect.any(String),
      user_code: expect.any(String),
      interval: 5,
      scope: 'organization:read'
    });
    expect(device.expires_in).toBeGreaterThan(0);
    expect(device.verification_uri_complete).toBe(device.verification_uri);
    expect(new URL(device.verification_uri).pathname).toBe('/oauth/authorize');
    expect(device.urlToken).toMatch(/^mtout_/);
    expect(device.verification_uri).not.toContain(device.device_code);

    let grant = { grant_type: deviceGrant, device_code: device.device_code };
    expectOAuthError(await postToken(grant, client), 400, 'authorization_pending');
    expectOAuthError(await postToken(grant, client), 400, 'slow_down');

    await acceptRequest(client.fixture, device.urlToken);

    await waitForNextPoll();
    expectOAuthError(
      await postForm('/oauth/token', { ...grant, client_id: client.clientId }),
      401,
      'invalid_client'
    );

    await waitForNextPoll();
    let response = await postToken(grant, client);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      token_type: 'Bearer',
      scope: 'organization:read',
      user: { id: org.ids.userId },
      organization: { id: org.ids.organizationId }
    });

    let organization = expectOk(
      await rest(metorialEndpoints().api, { apiKey: response.body.access_token }).get(
        '/organization'
      )
    );
    expect(organization.id).toBe(org.ids.organizationId);

    await waitForNextPoll();
    expectOAuthError(await postToken(grant, client), 400, 'invalid_grant', /consumed/);
  });

  it('reports denied device requests as access_denied', async () => {
    let client = await createApplication(org.ids);
    let device = await startDeviceAuthorization(client);

    await rejectRequest(client.fixture, device.urlToken);

    let response = await postToken(
      { grant_type: deviceGrant, device_code: device.device_code },
      client
    );
    expectOAuthError(response, 400, 'access_denied');
    expect(response.body.access_token).toBeUndefined();
  });

  it('binds device codes to their client', async () => {
    let client = await createApplication(org.ids);
    let otherClient = await createApplication(org.ids);
    let device = await startDeviceAuthorization(client);

    expectOAuthError(
      await postToken(
        { grant_type: deviceGrant, device_code: device.device_code },
        otherClient
      ),
      400,
      'invalid_grant'
    );
    expectOAuthError(
      await postToken({ grant_type: deviceGrant, device_code: 'unknown-device-code' }, client),
      400,
      'invalid_grant'
    );
  });

  it('validates device authorization requests', async () => {
    let client = await createApplication(org.ids);
    let serverSide = await createApplication(org.ids, { type: 'server_side' });

    expectOAuthError(
      await postForm('/oauth/device_authorization', { scope: 'organization:read' }),
      400,
      'invalid_request',
      /client_id/
    );
    expectOAuthError(
      await postForm('/oauth/device_authorization', { client_id: 'mt_oauth_unknown' }),
      401,
      'invalid_client'
    );
    expectOAuthError(
      await postForm(
        '/oauth/device_authorization',
        {},
        { authorization: basicAuth(client.clientId, `${client.clientSecret}x`) }
      ),
      401,
      'invalid_client'
    );
    expectOAuthError(
      await postForm(
        '/oauth/device_authorization',
        {},
        { authorization: basicAuth(serverSide.clientId, serverSide.clientSecret) }
      ),
      403,
      'unauthorized_client'
    );
    expectOAuthError(
      await postForm(
        '/oauth/device_authorization',
        { scope: 'organization:read', subject_type: 'robot' },
        { authorization: basicAuth(client.clientId, client.clientSecret) }
      ),
      400,
      'invalid_request',
      /subject_type/
    );
  });
});
