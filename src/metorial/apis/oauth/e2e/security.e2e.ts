import {
  expectOk,
  metorialEndpoints,
  rest,
  testContext,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { describe, expect, it } from 'vitest';
import {
  authorizeUrl,
  call,
  createApplication,
  createPkce,
  getAuthorizationRequest,
  getRequestToken,
  issueTokens,
  postToken,
  redirectUri
} from './_fixtures';

describe('api-oauth security', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org, { role: 'member' });

  let api = () => metorialEndpoints().api;

  it('only shows a decided authorization request to the user who decided it', async () => {
    let client = await createApplication(org.ids);
    let authorization = await issueTokens(client);
    let path = `/dashboard/oauth/authorization-requests/${authorization.urlToken}`;

    let approver = expectOk(await rest(api(), { session: org.session }).get(path));
    expect(approver.redirect_url).toContain('code=');

    let outsider = await rest(api(), { session: otherOrg.session }).get(path);
    expect(outsider.status).toBe(404);
    expect(outsider.text).not.toContain('code=');
  });

  it('stops honoring a member’s OAuth tokens once the member is removed', async () => {
    let client = await createApplication(org.ids);
    let memberFixture = await loadOrganizationFixture({ ...org.ids, userId: member.user.id });
    let pkce = createPkce();

    let consent = await call(
      authorizeUrl({
        response_type: 'code',
        client_id: client.clientId,
        redirect_uri: redirectUri,
        scope: 'organization:read',
        state: 'state',
        code_challenge: pkce.codeChallenge,
        code_challenge_method: 'S256'
      })
    );
    let accepted = await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
      oauthAuthorizationRequest: await getAuthorizationRequest(getRequestToken(consent)),
      user: memberFixture.user,
      organizationId: org.ids.organizationId,
      context: testContext()
    });

    let issued = await postToken(
      {
        grant_type: 'authorization_code',
        code: accepted.oauthAuthorizationRequest.code,
        redirect_uri: redirectUri,
        code_verifier: pkce.codeVerifier
      },
      client
    );
    expect(issued.status).toBe(200);

    let asMember = rest(api(), { apiKey: issued.body.access_token });
    expectOk(await asMember.get('/organization'));

    expectOk(await org.clients.management.delete(`/organization/members/${member.member.id}`));

    let afterRemoval = await asMember.get('/organization');
    expect(afterRemoval.status).toBe(401);

    let refreshed = await postToken(
      { grant_type: 'refresh_token', refresh_token: issued.body.refresh_token },
      client
    );
    expect(refreshed.status).toBe(400);
    expect(refreshed.body.error).toBe('invalid_grant');
  });
});
