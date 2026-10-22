import { uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { base64url, Ed25519 } from '@metorial-outpost/crypto';
import {
  decodeSignatureHeader,
  encodeSignatureHeader,
  OUTPOST_SIGNATURE_HEADER,
  PROTOCOL_VERSION
} from '@metorial-outpost/signature';
import { describe, expect, it } from 'vitest';
import { outpostCredentialService, outpostRegistrationService, outpostService } from '../src';
import {
  afterInvalidation,
  createOutpostWithCredential,
  createTestOutpostServer,
  decodeTokenPayload,
  importCredential,
  MCP_CONNECTION_PROXY_SERVICE,
  OUTPOST_PROTOCOL_SERVICE,
  postJson,
  readResponse,
  registerInstance,
  registrationBody,
  requestChallenge,
  sendSigned,
  signedRequest
} from './_fixtures';

describe('module-outpost registration', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = createTestOutpostServer();

  let findInstance = (outpostOid: bigint, identifier: string) =>
    db.outpostInstance.findUnique({
      where: { outpostOid_identifier: { outpostOid, identifier } },
      include: { services: true, keyRotations: true }
    });

  it('registers an instance through the challenge flow and persists it', async () => {
    let { outpost, credential, key } = await createOutpostWithCredential(org.ids);
    let before = Math.floor(Date.now() / 1000);

    let registered = await registerInstance(server, { credential: key });
    expect(registered.services).toEqual([
      { id: MCP_CONNECTION_PROXY_SERVICE, granted: false }
    ]);
    expect(registered.expiresAt).toBeGreaterThanOrEqual(before + 290);
    expect(registered.expiresAt).toBeLessThanOrEqual(before + 310);

    let token = decodeTokenPayload(registered.instanceToken);
    expect(token.d).toMatchObject({
      outpost_id: outpost.id,
      instance_id: registered.instanceId,
      credential_id: credential.id,
      services: []
    });

    let signingKeyPair = await db.outpostTokenKeyPair.findUniqueOrThrow({
      where: { id: token.k }
    });
    expect(signingKeyPair).toMatchObject({
      status: 'active',
      organizationOid: outpost.organizationOid,
      accountOid: outpost.accountOid
    });

    let instance = await findInstance(outpost.oid, registered.instanceId);
    expect(instance).toMatchObject({
      status: 'active',
      credentialOid: credential.oid,
      registrationCount: 1,
      keyRotationCount: 0,
      lastSeenIp: null
    });
    expect(Math.floor(instance!.expiresAt!.getTime() / 1000)).toBe(registered.expiresAt);
    expect(instance!.services).toEqual([
      expect.objectContaining({
        service: 'mcp_connection_proxy',
        version: '1',
        granted: false
      })
    ]);

    let outpostRow = await db.outpost.findUniqueOrThrow({ where: { oid: outpost.oid } });
    expect(outpostRow).toMatchObject({ connectionStatus: 'active', instanceCount: 1 });
    expect(outpostRow.lastSeenAt).not.toBeNull();

    let authorization = await outpostRegistrationService.resolveInstanceAuthorization({
      outpostId: outpost.id,
      instanceId: registered.instanceId,
      credentialId: credential.id
    });
    expect(authorization.status).toBe('active');
  });

  it('accepts each challenge once and rejects unknown or expired challenges', async () => {
    let { outpost, key } = await createOutpostWithCredential(org.ids);

    let challenge = await requestChallenge(server, { credential: key });
    expect(challenge.response.status).toBe(200);
    expect(challenge.response.body).toMatchObject({
      outpost_id: outpost.id,
      credential_id: key.id,
      instance_id: challenge.instanceId
    });

    let body = await registrationBody(challenge);
    expect((await postJson(server, '/outpost/register', body)).status).toBe(200);

    let replayed = await postJson(server, '/outpost/register', body);
    expect(replayed).toMatchObject({ status: 409, body: { error: 'consumed_challenge' } });

    let unknown = await postJson(server, '/outpost/register', {
      ...body,
      challenge_id: uniqueId('och')
    });
    expect(unknown).toMatchObject({ status: 400, body: { error: 'invalid_challenge' } });

    let expiringServer = createTestOutpostServer({ challengeTtlMs: -1_000 });
    let expiring = await requestChallenge(expiringServer, { credential: key });
    expect(expiring.response.status).toBe(200);

    let expired = await postJson(
      expiringServer,
      '/outpost/register',
      await registrationBody(expiring)
    );
    expect(expired).toMatchObject({ status: 400, body: { error: 'expired_challenge' } });
    expect(await findInstance(outpost.oid, expiring.instanceId)).toBeNull();
  });

  it('rejects malformed challenge requests', async () => {
    let { key } = await createOutpostWithCredential(org.ids);
    let instanceKeys = await Ed25519.generateKeyPair();
    let publicKey = base64url.encode(await Ed25519.exportPublicKey(instanceKeys.publicKey));

    let valid = {
      version: PROTOCOL_VERSION,
      outpost_id: key.outpostId,
      credential_id: key.id,
      instance_id: uniqueId('e2e-instance'),
      instance_public_key: publicKey,
      services: [{ id: MCP_CONNECTION_PROXY_SERVICE }]
    };
    expect((await postJson(server, '/outpost/register/challenge', valid)).status).toBe(200);

    for (let body of [
      { ...valid, version: PROTOCOL_VERSION + 1 },
      { ...valid, outpost_id: undefined },
      { ...valid, instance_public_key: base64url.encode(new Uint8Array(16)) },
      { ...valid, instance_public_key: '***' },
      { ...valid, services: 'mcp_connection_proxy' },
      {
        ...valid,
        services: [{ id: MCP_CONNECTION_PROXY_SERVICE }, { id: MCP_CONNECTION_PROXY_SERVICE }]
      },
      { ...valid, services: [{ id: MCP_CONNECTION_PROXY_SERVICE, version: 1 }] }
    ]) {
      let response = await postJson(server, '/outpost/register/challenge', body);
      expect(response, JSON.stringify(body)).toMatchObject({
        status: 400,
        body: { error: 'invalid_request' }
      });
    }

    let notJson = await readResponse(
      await server.request(
        new Request('http://outpost.test/outpost/register/challenge', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{'
        })
      )
    );
    expect(notJson).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
  });

  it('rejects registrations signed with the wrong keys', async () => {
    let { outpost, key } = await createOutpostWithCredential(org.ids);
    let foreign = await Ed25519.generateKeyPair();

    let cases = [
      {
        signers: { credentialKey: foreign.privateKey },
        error: 'invalid_registration_signature'
      },
      { signers: { instanceKey: foreign.privateKey }, error: 'invalid_instance_signature' },
      { signers: { instanceIdKey: foreign.privateKey }, error: 'invalid_credential_signature' }
    ];

    for (let testCase of cases) {
      let challenge = await requestChallenge(server, { credential: key });
      let response = await postJson(
        server,
        '/outpost/register',
        await registrationBody(challenge, testCase.signers)
      );

      expect(response).toMatchObject({ status: 401, body: { error: testCase.error } });
      expect(await findInstance(outpost.oid, challenge.instanceId)).toBeNull();
    }
  });

  it('does not resolve a credential under another outpost or organization', async () => {
    let first = await createOutpostWithCredential(org.ids);
    let sibling = await createOutpostWithCredential(org.ids);
    let foreign = await createOutpostWithCredential(otherOrg.ids);

    for (let attempt of [
      { credential: sibling.key, outpostId: first.outpost.id },
      { credential: foreign.key, outpostId: first.outpost.id },
      { credential: first.key, outpostId: foreign.outpost.id },
      { credential: { ...first.key, id: uniqueId('opc') }, outpostId: first.outpost.id }
    ]) {
      let challenge = await requestChallenge(server, attempt);
      expect(challenge.response).toMatchObject({
        status: 404,
        body: { error: 'unknown_outpost_credential' }
      });
    }

    let foreignManifest = await outpostRegistrationService.resolveManifest({
      outpostId: foreign.outpost.id,
      requestedBy: {
        outpostId: first.outpost.id,
        instanceId: uniqueId('instance'),
        credentialId: first.credential.id,
        service: OUTPOST_PROTOCOL_SERVICE,
        grantedServices: [],
        requestId: uniqueId('oprq'),
        timestamp: Math.floor(Date.now() / 1000),
        outpostChain: []
      }
    });
    expect(foreignManifest.status).toBe('unknown');
  });

  it('stops registration for disabled or deleted credentials and outposts', async () => {
    let { fixture, outpost, credential, key } = await createOutpostWithCredential(org.ids);
    let scope = { organization: fixture.organization, auditScope: fixture.auditScope };

    let credentialSettlesAs = (credentialId: string, status: string) =>
      afterInvalidation(async () => {
        let resolved = await outpostRegistrationService.resolveEnrollmentCredential({
          outpostId: outpost.id,
          credentialId
        });
        expect(resolved.status).toBe(status);
      });

    let pending = await requestChallenge(server, { credential: key });
    expect(pending.response.status).toBe(200);

    let disabled = await outpostCredentialService.disableCredential({
      ...scope,
      credential,
      outpost
    });
    await credentialSettlesAs(credential.id, 'revoked');

    let lateRegistration = await postJson(
      server,
      '/outpost/register',
      await registrationBody(pending)
    );
    expect(lateRegistration).toMatchObject({
      status: 403,
      body: { error: 'revoked_outpost_credential' }
    });

    let revoked = await requestChallenge(server, { credential: key });
    expect(revoked.response).toMatchObject({
      status: 403,
      body: { error: 'revoked_outpost_credential' }
    });

    await outpostCredentialService.deleteCredential({
      ...scope,
      credential: disabled,
      outpost
    });
    let deleted = await requestChallenge(server, { credential: key });
    expect(deleted.response.body.error).toBe('revoked_outpost_credential');

    let { envelope } = await outpostCredentialService.createCredential({
      ...scope,
      outpost,
      input: { name: uniqueId('credential') }
    });
    let freshKey = await importCredential(envelope);
    expect((await requestChallenge(server, { credential: freshKey })).response.status).toBe(
      200
    );

    let disabledOutpost = await outpostService.disableOutpost({ ...scope, outpost });
    await credentialSettlesAs(freshKey.id, 'registration_disabled');
    let whileDisabled = await requestChallenge(server, { credential: freshKey });
    expect(whileDisabled.response).toMatchObject({
      status: 403,
      body: { error: 'registration_disabled' }
    });

    let enabled = await outpostService.enableOutpost({ ...scope, outpost: disabledOutpost });
    await credentialSettlesAs(freshKey.id, 'ok');
    expect((await requestChallenge(server, { credential: freshKey })).response.status).toBe(
      200
    );

    let disabledAgain = await outpostService.disableOutpost({ ...scope, outpost: enabled });
    await outpostService.deleteOutpost({ ...scope, outpost: disabledAgain });
    await credentialSettlesAs(freshKey.id, 'registration_disabled');
    let afterDelete = await requestChallenge(server, { credential: freshKey });
    expect(afterDelete.response).toMatchObject({
      status: 403,
      body: { error: 'registration_disabled' }
    });
  });

  it('records a key rotation when an identifier re-registers with a new key', async () => {
    let { outpost, key } = await createOutpostWithCredential(org.ids);
    let instanceId = uniqueId('e2e-instance');
    let firstKeys = await Ed25519.generateKeyPair();

    await registerInstance(server, { credential: key, instanceId, instanceKeys: firstKeys });
    await registerInstance(server, { credential: key, instanceId, instanceKeys: firstKeys });

    let sameKey = await findInstance(outpost.oid, instanceId);
    expect(sameKey).toMatchObject({ registrationCount: 2, keyRotationCount: 0 });
    expect(sameKey!.keyRotations).toEqual([]);

    let rotated = await registerInstance(server, { credential: key, instanceId });
    let rotatedPublicKey = await Ed25519.exportPublicKey(rotated.instanceKeys.publicKey);

    let instance = await findInstance(outpost.oid, instanceId);
    expect(instance).toMatchObject({ registrationCount: 3, keyRotationCount: 1 });
    expect(new Uint8Array(instance!.publicKey)).toEqual(rotatedPublicKey);
    expect(instance!.keyRotations).toHaveLength(1);
    expect(new Uint8Array(instance!.keyRotations[0]!.publicKey)).toEqual(rotatedPublicKey);

    let outpostRow = await db.outpost.findUniqueOrThrow({ where: { oid: outpost.oid } });
    expect(outpostRow.instanceCount).toBe(1);
  });

  it('records a relayed registration ip only when it is an ip address', async () => {
    let { outpost, key } = await createOutpostWithCredential(org.ids);
    let relayOutpost = await createOutpostWithCredential(otherOrg.ids);
    let relay = await registerInstance(server, { credential: relayOutpost.key });

    let relayedRegistration = async (proxyContext: Record<string, string>) => {
      let challenge = await requestChallenge(server, { credential: key });
      let request = await signedRequest(relay, {
        url: 'http://outpost.test/outpost/register',
        method: 'POST',
        service: OUTPOST_PROTOCOL_SERVICE,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(await registrationBody(challenge)),
        proxyContext
      });

      return { challenge, request };
    };

    let routable = await relayedRegistration({ ip: '203.0.113.7' });
    expect((await sendSigned(server, routable.request)).status).toBe(200);
    expect(await findInstance(outpost.oid, routable.challenge.instanceId)).toMatchObject({
      lastSeenIp: '203.0.113.7'
    });

    let garbage = await relayedRegistration({ ip: 'not-an-ip' });
    expect((await sendSigned(server, garbage.request)).status).toBe(200);
    expect(await findInstance(outpost.oid, garbage.challenge.instanceId)).toMatchObject({
      lastSeenIp: null
    });

    let tampered = await relayedRegistration({ ip: '203.0.113.8' });
    let headers = tampered.request.init.headers as Record<string, string>;
    let metadata = decodeSignatureHeader(headers[OUTPOST_SIGNATURE_HEADER]!);
    headers[OUTPOST_SIGNATURE_HEADER] = encodeSignatureHeader({
      ...metadata,
      proxy_context: { ip: '198.51.100.1' }
    });

    let rejected = await sendSigned(server, tampered.request);
    expect(rejected).toMatchObject({ status: 401, body: { error: 'invalid_signature' } });

    let direct = await postJson(
      server,
      '/outpost/register',
      await registrationBody(tampered.challenge)
    );
    expect(direct.status).toBe(200);
    expect(await findInstance(outpost.oid, tampered.challenge.instanceId)).toMatchObject({
      lastSeenIp: null
    });
  });
});
