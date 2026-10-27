import { eventually, uniqueId } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { decodeCredentialEnvelope } from '@metorial-outpost/credential-envelope';
import { base64url, Ed25519, type Ed25519KeyPair } from '@metorial-outpost/crypto';
import {
  createOutpostServer,
  InMemoryChallengeStore,
  OUTPOST_PROTOCOL_SERVICE,
  OutpostServerError,
  verifyOutpostRequest
} from '@metorial-outpost/server';
import {
  canonicalizeSignedHeaders,
  encodeSignatureHeader,
  generateRequestId,
  hashBody,
  OUTPOST_ID_HEADER,
  OUTPOST_INSTANCE_TOKEN_HEADER,
  OUTPOST_SIGNATURE_HEADER,
  PROTOCOL_VERSION,
  signInstanceId,
  signRegistration,
  signRequest
} from '@metorial-outpost/signature';
import { Hono } from 'hono';
import type { OutpostServiceName } from '../src/lib/services';
import { getOutpostSigningTokens, outpostVerificationTokens } from '../src/lib/tokens';
import {
  metorialOutpostResolver,
  outpostCredentialService,
  outpostService
} from '../src/services';

export { OUTPOST_PROTOCOL_SERVICE };

export let MCP_CONNECTION_PROXY_SERVICE: OutpostServiceName = 'mcp_connection_proxy';

export let CACHE_INVALIDATION_BOUND_MS = 10_000;

export let afterInvalidation = <T>(check: () => Promise<T>) =>
  eventually(check, { timeoutMs: CACHE_INVALIDATION_BOUND_MS, intervalMs: 500 });

export let createTestOutpostServer = (opts: { challengeTtlMs?: number } = {}) =>
  createOutpostServer({
    resolver: metorialOutpostResolver,
    tokens: outpostVerificationTokens,
    signer: ({ outpostId }) => getOutpostSigningTokens({ outpostId }),
    challengeStore: new InMemoryChallengeStore(),
    challengeTtlMs: opts.challengeTtlMs
  });

export type TestOutpostServer = ReturnType<typeof createTestOutpostServer>;

export let createConnectionVerifier = () => {
  let app = new Hono();

  app.onError((error, c) => {
    if (error instanceof OutpostServerError) {
      return c.json({ error: error.code }, error.status as 401);
    }

    return c.json({ error: 'internal_server_error', message: String(error) }, 500);
  });

  app.all('*', async c =>
    c.json(
      await verifyOutpostRequest(
        {
          tokens: outpostVerificationTokens,
          service: MCP_CONNECTION_PROXY_SERVICE,
          resolver: metorialOutpostResolver
        },
        c as any
      )
    )
  );

  return app;
};

export let readResponse = async (response: Response) => {
  let text = await response.text();
  let body: any = undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  return { status: response.status, body };
};

export let postJson = async (
  server: { request: (input: Request) => Response | Promise<Response> },
  path: string,
  body: unknown
) =>
  readResponse(
    await server.request(
      new Request(`http://outpost.test${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
    )
  );

export type TestCredential = {
  id: string;
  outpostId: string;
  privateKey: CryptoKey;
  envelope: string;
};

export let importCredential = async (envelope: string): Promise<TestCredential> => {
  let decoded = decodeCredentialEnvelope(envelope);

  return {
    id: decoded.credential_id,
    outpostId: decoded.outpost_id,
    privateKey: await Ed25519.importPrivateKey(base64url.decode(decoded.private_key)),
    envelope
  };
};

export let createOutpostWithCredential = async (
  ids: { organizationId: string; userId?: string },
  input: { expiresAt?: Date } = {}
) => {
  let fixture = await loadOrganizationFixture(ids);

  let outpost = await outpostService.createOutpost({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('e2e-outpost') }
  });

  let { credential, envelope } = await outpostCredentialService.createCredential({
    outpost,
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('e2e-credential'), expiresAt: input.expiresAt }
  });

  return { fixture, outpost, credential, envelope, key: await importCredential(envelope) };
};

export type ChallengeInput = {
  credential: TestCredential;
  outpostId?: string;
  instanceId?: string;
  instanceKeys?: Ed25519KeyPair;
  services?: { id: string; version?: string; capabilities?: Record<string, unknown> }[];
};

export let requestChallenge = async (server: TestOutpostServer, input: ChallengeInput) => {
  let instanceKeys = input.instanceKeys ?? (await Ed25519.generateKeyPair());
  let instancePublicKey = await Ed25519.exportPublicKey(instanceKeys.publicKey);
  let outpostId = input.outpostId ?? input.credential.outpostId;
  let instanceId = input.instanceId ?? uniqueId('e2e-instance');

  let response = await postJson(server, '/outpost/register/challenge', {
    version: PROTOCOL_VERSION,
    outpost_id: outpostId,
    credential_id: input.credential.id,
    instance_id: instanceId,
    instance_public_key: base64url.encode(instancePublicKey),
    services: input.services ?? [{ id: MCP_CONNECTION_PROXY_SERVICE, version: '1' }]
  });

  return {
    response,
    outpostId,
    instanceId,
    instanceKeys,
    instancePublicKey,
    credential: input.credential
  };
};

export type IssuedChallenge = Awaited<ReturnType<typeof requestChallenge>>;

export let registrationBody = async (
  challenge: IssuedChallenge,
  signers: {
    credentialKey?: CryptoKey;
    instanceKey?: CryptoKey;
    instanceIdKey?: CryptoKey;
  } = {}
) => {
  let input = {
    challengeId: challenge.response.body.challenge_id,
    challenge: base64url.decode(challenge.response.body.challenge),
    outpostId: challenge.outpostId,
    credentialId: challenge.credential.id,
    instanceId: challenge.instanceId,
    instancePublicKey: challenge.instancePublicKey
  };

  return {
    version: PROTOCOL_VERSION,
    challenge_id: input.challengeId,
    signature: await signRegistration(
      signers.credentialKey ?? challenge.credential.privateKey,
      input
    ),
    instance_signature: await signRegistration(
      signers.instanceKey ?? challenge.instanceKeys.privateKey,
      input
    ),
    credential_instance_id_signature: await signInstanceId(
      signers.instanceIdKey ?? challenge.credential.privateKey,
      {
        outpostId: input.outpostId,
        credentialId: input.credentialId,
        instanceId: input.instanceId
      }
    )
  };
};

export type RegisteredInstance = {
  outpostId: string;
  instanceId: string;
  credentialId: string;
  instanceKeys: Ed25519KeyPair;
  instanceToken: string;
  services: { id: string; granted: boolean }[];
  expiresAt: number;
};

export let registerInstance = async (
  server: TestOutpostServer,
  input: ChallengeInput
): Promise<RegisteredInstance> => {
  let challenge = await requestChallenge(server, input);
  if (challenge.response.status != 200) {
    throw new Error(`Challenge failed: ${JSON.stringify(challenge.response)}`);
  }

  let registered = await postJson(
    server,
    '/outpost/register',
    await registrationBody(challenge)
  );
  if (registered.status != 200) {
    throw new Error(`Registration failed: ${JSON.stringify(registered)}`);
  }

  return {
    outpostId: challenge.outpostId,
    instanceId: challenge.instanceId,
    credentialId: challenge.credential.id,
    instanceKeys: challenge.instanceKeys,
    instanceToken: registered.body.instance_token,
    services: registered.body.services,
    expiresAt: registered.body.expires_at
  };
};

export let signedRequest = async (
  instance: RegisteredInstance,
  input: {
    url: string;
    service: string;
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    proxyContext?: Record<string, string>;
    timestamp?: number;
    instanceToken?: string;
    signingKey?: CryptoKey;
    outpostIdHeader?: string;
  }
) => {
  let url = new URL(input.url);
  let method = input.method ?? 'GET';
  let headers = { ...input.headers };
  let signedHeaderNames = Object.keys(headers).map(name => name.toLowerCase());
  let timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  let requestId = generateRequestId();

  let signature = await signRequest(input.signingKey ?? instance.instanceKeys.privateKey, {
    outpostId: instance.outpostId,
    instanceId: instance.instanceId,
    timestamp,
    requestId,
    service: input.service,
    method,
    scheme: url.protocol.replace(/:$/, ''),
    authority: url.host,
    path: url.pathname,
    query: url.search.replace(/^\?/, ''),
    signedHeaders: canonicalizeSignedHeaders(headers, signedHeaderNames),
    bodySha256: await hashBody(new TextEncoder().encode(input.body ?? '')),
    proxyContext: input.proxyContext
  });

  let metadata = encodeSignatureHeader({
    version: PROTOCOL_VERSION,
    outpost_id: instance.outpostId,
    timestamp,
    request_id: requestId,
    service: input.service,
    signed_headers: signedHeaderNames,
    signature,
    proxy_context: input.proxyContext
  });

  return {
    url: url.toString(),
    init: {
      method,
      body: input.body,
      headers: {
        ...headers,
        [OUTPOST_ID_HEADER]: input.outpostIdHeader ?? instance.outpostId,
        [OUTPOST_SIGNATURE_HEADER]: metadata,
        [OUTPOST_INSTANCE_TOKEN_HEADER]: input.instanceToken ?? instance.instanceToken
      }
    }
  };
};

export let sendSigned = async (
  app: { request: (input: Request) => Response | Promise<Response> },
  request: Awaited<ReturnType<typeof signedRequest>>
) => readResponse(await app.request(new Request(request.url, request.init)));

let TOKEN_PAYLOAD_PREFIX = 'mtopt';

export let decodeTokenPayload = (token: string) => {
  let parts = token.split('.');
  let decoded = new TextDecoder().decode(base64url.decode(parts[parts.length - 2]!));

  return JSON.parse(decoded.slice(TOKEN_PAYLOAD_PREFIX.length)) as {
    d: Record<string, any>;
    e?: number;
    c: number;
    k: string;
  };
};

export let replaceTokenPayload = (token: string, payload: Record<string, any>) => {
  let parts = token.split('.');
  parts[parts.length - 2] = base64url.encode(
    new TextEncoder().encode(TOKEN_PAYLOAD_PREFIX + JSON.stringify(payload))
  );

  return parts.join('.');
};
