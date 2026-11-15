import { metorialEndpoints, rest, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { outpostCredentialService, outpostService } from '@metorial/module-outpost';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

let randomPublicKey = () => randomBytes(32).toString('base64url');

let challengeBody = (d: { outpostId: string; credentialId: string }) => ({
  version: 1,
  outpost_id: d.outpostId,
  credential_id: d.credentialId,
  instance_id: uniqueId('outpost-instance'),
  instance_public_key: randomPublicKey()
});

describe('api-outpost', () => {
  let org = useOrganization();

  it('rejects malformed registration challenges', async () => {
    let api = rest(metorialEndpoints().api);

    let notJson = await api.post('/outpost/register/challenge', undefined, {
      headers: { 'content-type': 'application/json' }
    });
    expect(notJson.status).toBe(400);
    expect(notJson.body.error).toBe('invalid_request');

    let badKey = await api.post('/outpost/register/challenge', {
      ...challengeBody({ outpostId: uniqueId('opst'), credentialId: uniqueId('opcr') }),
      instance_public_key: randomBytes(8).toString('base64url')
    });
    expect(badKey.status).toBe(400);
    expect(badKey.body.error).toBe('invalid_request');
  });

  it('rejects unknown credentials, challenges and unauthenticated reads', async () => {
    let api = rest(metorialEndpoints().api);

    let unknownCredential = await api.post(
      '/outpost/register/challenge',
      challengeBody({ outpostId: uniqueId('opst'), credentialId: uniqueId('opcr') })
    );
    expect(unknownCredential.status).toBe(404);
    expect(unknownCredential.body.error).toBe('unknown_outpost_credential');

    let unknownChallenge = await api.post('/outpost/register', {
      version: 1,
      challenge_id: uniqueId('och'),
      signature: 'sig',
      instance_signature: 'sig',
      credential_instance_id_signature: 'sig'
    });
    expect(unknownChallenge.status).toBe(400);
    expect(unknownChallenge.body.error).toBe('invalid_challenge');

    let manifest = await api.get(`/outpost/manifest/${uniqueId('opst')}`);
    expect(manifest.status).toBe(401);
    expect(manifest.body.error).toBe('missing_authentication');

    let issuerKey = await api.get(`/outpost/issuer-key/${uniqueId('kid')}`);
    expect(issuerKey.status).toBe(404);
    expect(issuerKey.body.error).toBe('unknown_issuer_key');
  });

  it('issues a registration challenge for an active outpost credential', async () => {
    let fixture = await loadOrganizationFixture({
      organizationId: org.ids.organizationId,
      userId: org.ids.userId
    });
    let outpost = await outpostService.createOutpost({
      organization: fixture.organization,
      input: { name: uniqueId('e2e-outpost') },
      auditScope: fixture.auditScope
    });
    let { credential } = await outpostCredentialService.createCredential({
      outpost,
      organization: fixture.organization,
      input: { name: uniqueId('e2e-credential') },
      auditScope: fixture.auditScope
    });

    let response = await rest(metorialEndpoints().api).post(
      '/outpost/register/challenge',
      challengeBody({ outpostId: outpost.id, credentialId: credential.id })
    );
    expect(response.status).toBe(200);
    expect(response.body.version).toBe(1);
    expect(response.body.challenge_id).toMatch(/^och_/);
    expect(response.body.outpost_id).toBe(outpost.id);
    expect(response.body.credential_id).toBe(credential.id);
    expect(typeof response.body.challenge).toBe('string');
  });
});
