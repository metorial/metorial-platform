import { uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { Fabric } from '@metorial/fabric';
import { Ed25519 } from '@metorial-outpost/crypto';
import { INSTANCE_TOKEN_TYPE } from '@metorial-outpost/server';
import {
  decodeSignatureHeader,
  encodeSignatureHeader,
  OUTPOST_SIGNATURE_HEADER
} from '@metorial-outpost/signature';
import { OutpostTokens } from '@metorial-outpost/tokens';
import { describe, expect, it } from 'vitest';
import {
  cachedInstanceAuthorization,
  getOutpostSigningTokens,
  outpostCredentialService,
  outpostInstanceService,
  outpostService,
  outpostTag,
  outpostTokenKeyPairService
} from '../src';
import {
  afterInvalidation,
  createConnectionVerifier,
  createOutpostWithCredential,
  createTestOutpostServer,
  decodeTokenPayload,
  importCredential,
  MCP_CONNECTION_PROXY_SERVICE,
  OUTPOST_PROTOCOL_SERVICE,
  readResponse,
  registerInstance,
  replaceTokenPayload,
  sendSigned,
  signedRequest,
  type RegisteredInstance
} from './_fixtures';

describe('module-outpost request authentication', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let replacedKeyOrg = useOrganization();
  let revokedKeyOrg = useOrganization();

  let server = createTestOutpostServer();
  let verifier = createConnectionVerifier();

  let callVerifier = async (
    instance: RegisteredInstance,
    input: Partial<Parameters<typeof signedRequest>[1]> = {}
  ) =>
    sendSigned(
      verifier,
      await signedRequest(instance, {
        url: 'https://connect.test/mcp/session?x=1',
        service: MCP_CONNECTION_PROXY_SERVICE,
        ...input
      })
    );

  let findInstanceRow = (instance: RegisteredInstance) =>
    db.outpostInstance.findFirstOrThrow({
      where: { identifier: instance.instanceId, outpost: { id: instance.outpostId } },
      include: { outpost: { include: { organization: true } } }
    });

  it('authenticates a signed request and passes the signed proxy context through', async () => {
    let { outpost, credential, key } = await createOutpostWithCredential(org.ids);
    let instance = await registerInstance(server, { credential: key });

    let response = await callVerifier(instance, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
      proxyContext: { ip: '203.0.113.10' }
    });

    expect(response).toEqual({
      status: 200,
      body: expect.objectContaining({
        outpostId: outpost.id,
        instanceId: instance.instanceId,
        credentialId: credential.id,
        service: MCP_CONNECTION_PROXY_SERVICE,
        grantedServices: [],
        proxyContext: { ip: '203.0.113.10' }
      })
    });
  });

  it('rejects requests whose signature or metadata does not match', async () => {
    let { key } = await createOutpostWithCredential(org.ids);
    let instance = await registerInstance(server, { credential: key });
    let otherInstance = await registerInstance(server, { credential: key });
    let foreignKeys = await Ed25519.generateKeyPair();
    let now = Math.floor(Date.now() / 1000);

    let unsigned = await readResponse(
      await verifier.request(new Request('https://connect.test/mcp/session'))
    );
    expect(unsigned).toMatchObject({ status: 401, body: { error: 'missing_authentication' } });

    let rewrite = async (
      mutate: (request: Awaited<ReturnType<typeof signedRequest>>) => void,
      input: Partial<Parameters<typeof signedRequest>[1]> = {}
    ) => {
      let request = await signedRequest(instance, {
        url: 'https://connect.test/mcp/session?x=1',
        service: MCP_CONNECTION_PROXY_SERVICE,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"a":1}',
        proxyContext: { ip: '203.0.113.10' },
        ...input
      });
      mutate(request);

      return sendSigned(verifier, request);
    };

    let headersOf = (request: Awaited<ReturnType<typeof signedRequest>>) =>
      request.init.headers as Record<string, string>;

    type TamperCase = {
      name: string;
      status: number;
      error: string;
      mutate?: (request: Awaited<ReturnType<typeof signedRequest>>) => void;
      input?: Partial<Parameters<typeof signedRequest>[1]>;
    };

    let cases: TamperCase[] = [
      {
        name: 'malformed signature header',
        status: 400,
        error: 'malformed_signature_header',
        mutate: request => (headersOf(request)[OUTPOST_SIGNATURE_HEADER] = 'garbage')
      },
      {
        name: 'body changed',
        status: 401,
        error: 'invalid_signature',
        mutate: request => (request.init.body = '{"a":2}')
      },
      {
        name: 'path changed',
        status: 401,
        error: 'invalid_signature',
        mutate: request => (request.url = 'https://connect.test/mcp/other?x=1')
      },
      {
        name: 'query changed',
        status: 401,
        error: 'invalid_signature',
        mutate: request => (request.url = 'https://connect.test/mcp/session?x=2')
      },
      {
        name: 'method changed',
        status: 401,
        error: 'invalid_signature',
        mutate: request => (request.init.method = 'PUT')
      },
      {
        name: 'signed header changed',
        status: 401,
        error: 'invalid_signature',
        mutate: request => (headersOf(request)['content-type'] = 'text/plain')
      },
      {
        name: 'proxy context changed',
        status: 401,
        error: 'invalid_signature',
        mutate: request => {
          let headers = headersOf(request);
          headers[OUTPOST_SIGNATURE_HEADER] = encodeSignatureHeader({
            ...decodeSignatureHeader(headers[OUTPOST_SIGNATURE_HEADER]!),
            proxy_context: { ip: '198.51.100.1' }
          });
        }
      },
      {
        name: 'unsigned required header added',
        status: 400,
        error: 'missing_required_signed_header',
        mutate: request => (headersOf(request)['content-encoding'] = 'gzip')
      },
      {
        name: 'signed with a foreign key',
        status: 401,
        error: 'invalid_signature',
        input: { signingKey: foreignKeys.privateKey }
      },
      {
        name: "another instance's token",
        status: 401,
        error: 'invalid_signature',
        input: { instanceToken: otherInstance.instanceToken }
      },
      {
        name: 'different outpost id header',
        status: 401,
        error: 'outpost_mismatch',
        input: { outpostIdHeader: uniqueId('otp') }
      },
      {
        name: 'another service',
        status: 403,
        error: 'service_mismatch',
        input: { service: OUTPOST_PROTOCOL_SERVICE }
      },
      {
        name: 'stale timestamp',
        status: 401,
        error: 'stale_request',
        input: { timestamp: now - 301 }
      },
      {
        name: 'future timestamp',
        status: 401,
        error: 'future_request',
        input: { timestamp: now + 60 }
      }
    ];

    for (let testCase of cases) {
      let response = await rewrite(testCase.mutate ?? (() => {}), testCase.input);
      expect({ status: response.status, error: response.body?.error }, testCase.name).toEqual({
        status: testCase.status,
        error: testCase.error
      });
    }
  });

  it('rejects forged, tampered, expired and foreign instance tokens', async () => {
    let { outpost, key } = await createOutpostWithCredential(org.ids);
    let instance = await registerInstance(server, { credential: key });
    let sibling = await registerInstance(server, { credential: key });
    let foreign = await createOutpostWithCredential(otherOrg.ids);
    let foreignInstance = await registerInstance(server, { credential: foreign.key });

    let payload = decodeTokenPayload(instance.instanceToken);
    let realSigner = await getOutpostSigningTokens({ outpostId: outpost.id });

    let foreignSigningKeys = await Ed25519.generateKeyPair();
    let forger = (kid: string) =>
      new OutpostTokens({
        signing: {
          kid,
          privateKey: foreignSigningKeys.privateKey,
          publicKey: foreignSigningKeys.publicKey
        }
      });

    let freshlyMinted = await realSigner.sign({
      type: INSTANCE_TOKEN_TYPE,
      data: payload.d,
      expiresAt: new Date(Date.now() + 60_000)
    });
    expect((await callVerifier(instance, { instanceToken: freshlyMinted })).status).toBe(200);

    let tokens: Record<string, string> = {
      'forged under the real kid': await forger(payload.k).sign({
        type: INSTANCE_TOKEN_TYPE,
        data: payload.d,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      'forged under an unknown kid': await forger(uniqueId('otkp')).sign({
        type: INSTANCE_TOKEN_TYPE,
        data: payload.d,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      'payload rewritten to another instance': replaceTokenPayload(instance.instanceToken, {
        ...payload,
        d: { ...payload.d, instance_id: sibling.instanceId }
      }),
      'expiry extended': replaceTokenPayload(instance.instanceToken, {
        ...payload,
        e: Date.now() + 24 * 60 * 60 * 1000
      }),
      expired: await realSigner.sign({
        type: INSTANCE_TOKEN_TYPE,
        data: payload.d,
        expiresAt: new Date(Date.now() - 10_000)
      }),
      'wrong token type': await realSigner.sign({
        type: 'metorial-outpost-other',
        data: payload.d,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      'not a token': 'not-a-token'
    };

    for (let [name, instanceToken] of Object.entries(tokens)) {
      let response = await callVerifier(instance, { instanceToken });
      expect({ name, status: response.status, error: response.body?.error }, name).toEqual({
        name,
        status: 401,
        error: 'invalid_instance_token'
      });
    }

    let crossTenant = await callVerifier(instance, {
      instanceToken: foreignInstance.instanceToken
    });
    expect(crossTenant).toMatchObject({ status: 401, body: { error: 'outpost_mismatch' } });
  });

  it('stops authenticating instances of a disabled or rotated credential', async () => {
    let { fixture, outpost, credential, key } = await createOutpostWithCredential(org.ids);
    let scope = {
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      outpost
    };
    let oldInstance = await registerInstance(server, { credential: key });

    let { envelope } = await outpostCredentialService.createCredential({
      ...scope,
      input: { name: uniqueId('rotated') }
    });
    let rotatedKey = await importCredential(envelope);
    let newInstance = await registerInstance(server, { credential: rotatedKey });

    expect((await callVerifier(oldInstance)).status).toBe(200);
    expect((await callVerifier(newInstance)).status).toBe(200);

    let disabled = await outpostCredentialService.disableCredential({ ...scope, credential });

    await afterInvalidation(async () => {
      expect(await callVerifier(oldInstance)).toMatchObject({
        status: 403,
        body: { error: 'instance_disabled' }
      });
    });
    expect((await callVerifier(newInstance)).status).toBe(200);

    await outpostCredentialService.deleteCredential({ ...scope, credential: disabled });
    await afterInvalidation(async () => {
      expect(await callVerifier(oldInstance)).toMatchObject({
        status: 403,
        body: { error: 'instance_disabled' }
      });
    });

    let movedInstance = await registerInstance(server, {
      credential: rotatedKey,
      instanceId: oldInstance.instanceId
    });
    await afterInvalidation(async () => {
      expect(await callVerifier(oldInstance)).toMatchObject({
        status: 401,
        body: { error: 'invalid_instance_token' }
      });
    });
    expect((await callVerifier(movedInstance)).status).toBe(200);
  });

  it('stops authenticating deactivated instances and disabled outposts', async () => {
    let { fixture, outpost, key } = await createOutpostWithCredential(org.ids);
    let scope = { organization: fixture.organization, auditScope: fixture.auditScope };
    let instance = await registerInstance(server, { credential: key });
    let bystander = await registerInstance(server, { credential: key });

    let row = await findInstanceRow(instance);
    await outpostInstanceService.deactivateInstance({
      instance: row,
      outpost: row.outpost,
      organization: row.outpost.organization
    });

    await afterInvalidation(async () => {
      expect(await callVerifier(instance)).toMatchObject({
        status: 403,
        body: { error: 'instance_disabled' }
      });
    });
    expect((await callVerifier(bystander)).status).toBe(200);

    let disabled = await outpostService.disableOutpost({ ...scope, outpost });
    await afterInvalidation(async () => {
      expect(await callVerifier(bystander)).toMatchObject({
        status: 403,
        body: { error: 'outpost_disabled' }
      });
    });

    await outpostService.enableOutpost({ ...scope, outpost: disabled });
    await afterInvalidation(async () => {
      expect((await callVerifier(bystander)).status).toBe(200);
    });
    expect((await callVerifier(instance)).status).toBe(403);

    let reregistered = await registerInstance(server, {
      credential: key,
      instanceId: instance.instanceId,
      instanceKeys: instance.instanceKeys
    });
    expect((await callVerifier(reregistered)).status).toBe(200);
  });

  it('does not let a lookup during the disable transaction keep the outpost authorized', async () => {
    let { fixture, outpost, key } = await createOutpostWithCredential(org.ids);
    let instance = await registerInstance(server, { credential: key });
    expect((await callVerifier(instance)).status).toBe(200);

    let inFlight: Awaited<ReturnType<typeof callVerifier>> | undefined;
    let unlisten = Fabric.listen('outpost.disabled:after', async event => {
      if (event.outpost.id != outpost.id) return;

      await cachedInstanceAuthorization.clearByTagAndWait(outpostTag(outpost.id));
      inFlight = await callVerifier(instance);
    });

    try {
      await outpostService.disableOutpost({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        outpost
      });
    } finally {
      unlisten();
    }

    expect(inFlight?.status).toBe(200);
    await afterInvalidation(async () => {
      expect(await callVerifier(instance)).toMatchObject({
        status: 403,
        body: { error: 'outpost_disabled' }
      });
    });
  });

  it('serves manifests and credential public keys only to outposts in the same family', async () => {
    let { outpost, credential, key } = await createOutpostWithCredential(org.ids);
    let instance = await registerInstance(server, { credential: key });
    let foreign = await createOutpostWithCredential(otherOrg.ids);
    let foreignInstance = await registerInstance(server, { credential: foreign.key });

    let get = (requester: RegisteredInstance, path: string) =>
      signedRequest(requester, {
        url: `http://outpost.test${path}`,
        service: OUTPOST_PROTOCOL_SERVICE
      }).then(request => sendSigned(server, request));

    let unauthenticated = await readResponse(
      await server.request(new Request(`http://outpost.test/outpost/manifest/${outpost.id}`))
    );
    expect(unauthenticated).toMatchObject({
      status: 401,
      body: { error: 'missing_authentication' }
    });

    let manifest = await get(instance, `/outpost/manifest/${outpost.id}`);
    expect(manifest).toMatchObject({
      status: 200,
      body: { outpost: { id: outpost.id, name: outpost.name }, access: [] }
    });

    let publicKey = await get(instance, `/outpost/public-key/${outpost.id}/${credential.id}`);
    expect(publicKey).toMatchObject({
      status: 200,
      body: { outpost_id: outpost.id, credential_id: credential.id }
    });

    expect(await get(foreignInstance, `/outpost/manifest/${outpost.id}`)).toMatchObject({
      status: 404,
      body: { error: 'unknown_outpost' }
    });
    expect(
      await get(foreignInstance, `/outpost/public-key/${outpost.id}/${credential.id}`)
    ).toMatchObject({ status: 404, body: { error: 'unknown_outpost_credential' } });

    let wrongService = await sendSigned(
      server,
      await signedRequest(instance, {
        url: `http://outpost.test/outpost/manifest/${outpost.id}`,
        service: MCP_CONNECTION_PROXY_SERVICE
      })
    );
    expect(wrongService).toMatchObject({ status: 403, body: { error: 'service_mismatch' } });
  });

  it('keeps verifying a replaced token key pair until its grace period ends', async () => {
    let fixture = await loadOrganizationFixture(replacedKeyOrg.ids);
    let { key } = await createOutpostWithCredential(replacedKeyOrg.ids);
    let instance = await registerInstance(server, { credential: key });

    let kid = decodeTokenPayload(instance.instanceToken).k;
    let keyPair = await db.outpostTokenKeyPair.findUniqueOrThrow({ where: { id: kid } });

    let issuerKey = await readResponse(
      await server.request(new Request(`http://outpost.test/outpost/issuer-key/${kid}`))
    );
    expect(issuerKey).toMatchObject({ status: 200, body: { kid } });

    let replaced = await outpostTokenKeyPairService.demoteElapsedKeyPairs({
      where: { organizationOid: fixture.organization.oid },
      now: new Date(keyPair.stopSigningAt.getTime() + 1_000)
    });
    expect(replaced).toEqual({ replaced: 1, expired: 0 });
    expect(
      await db.outpostTokenKeyPair.findUniqueOrThrow({ where: { id: kid } })
    ).toMatchObject({ status: 'replaced' });

    expect((await callVerifier(instance)).status).toBe(200);

    let successor = await registerInstance(server, { credential: key });
    let successorKid = decodeTokenPayload(successor.instanceToken).k;
    expect(successorKid).not.toBe(kid);
    expect((await callVerifier(successor)).status).toBe(200);

    let successorKeyPair = await db.outpostTokenKeyPair.findUniqueOrThrow({
      where: { id: successorKid }
    });
    expect(successorKeyPair.stopVerifyingAt.getTime()).toBeGreaterThan(
      keyPair.stopVerifyingAt.getTime()
    );

    let expired = await outpostTokenKeyPairService.demoteElapsedKeyPairs({
      where: { organizationOid: fixture.organization.oid },
      now: keyPair.stopVerifyingAt
    });
    expect(expired.expired).toBe(1);
    expect(
      await db.outpostTokenKeyPair.findUniqueOrThrow({ where: { id: kid } })
    ).toMatchObject({ status: 'expired' });

    await afterInvalidation(async () => {
      expect(await callVerifier(instance)).toMatchObject({
        status: 401,
        body: { error: 'invalid_instance_token' }
      });

      let expiredIssuerKey = await readResponse(
        await server.request(new Request(`http://outpost.test/outpost/issuer-key/${kid}`))
      );
      expect(expiredIssuerKey).toMatchObject({
        status: 404,
        body: { error: 'unknown_issuer_key' }
      });
    });
    expect((await callVerifier(successor)).status).toBe(200);
  });

  it('rejects every token signed by a revoked token key pair', async () => {
    let fixture = await loadOrganizationFixture(revokedKeyOrg.ids);
    let { key } = await createOutpostWithCredential(revokedKeyOrg.ids);
    let first = await registerInstance(server, { credential: key });
    let second = await registerInstance(server, { credential: key });

    let kid = decodeTokenPayload(first.instanceToken).k;
    expect(decodeTokenPayload(second.instanceToken).k).toBe(kid);
    expect((await callVerifier(first)).status).toBe(200);

    let keyPair = await db.outpostTokenKeyPair.findUniqueOrThrow({ where: { id: kid } });
    await outpostTokenKeyPairService.revokeKeyPair({
      keyPair,
      organization: fixture.organization
    });

    await afterInvalidation(async () => {
      for (let instance of [first, second]) {
        expect(await callVerifier(instance)).toMatchObject({
          status: 401,
          body: { error: 'invalid_instance_token' }
        });
      }
    });

    let reregistered = await registerInstance(server, {
      credential: key,
      instanceId: first.instanceId,
      instanceKeys: first.instanceKeys
    });
    expect(decodeTokenPayload(reregistered.instanceToken).k).not.toBe(kid);
    expect((await callVerifier(reregistered)).status).toBe(200);
  });

  it.fails(
    'rejects a replayed signed request (bug: outpost-server never records request_id, so a captured request can be replayed within the 300s freshness window)',
    async () => {
      let { key } = await createOutpostWithCredential(org.ids);
      let instance = await registerInstance(server, { credential: key });

      let request = await signedRequest(instance, {
        url: 'https://connect.test/mcp/session',
        service: MCP_CONNECTION_PROXY_SERVICE
      });

      expect((await sendSigned(verifier, request)).status).toBe(200);
      expect((await sendSigned(verifier, request)).status).toBe(401);
    }
  );

  it.fails(
    "rejects the previous instance key after the identifier re-registers with a new key (bug: instance authorization doesn't compare the token's instance_public_key with the stored key, so the superseded key keeps working until its token expires)",
    async () => {
      let { key } = await createOutpostWithCredential(org.ids);
      let previous = await registerInstance(server, { credential: key });

      await registerInstance(server, { credential: key, instanceId: previous.instanceId });

      expect((await callVerifier(previous)).status).toBe(401);
    }
  );
});
