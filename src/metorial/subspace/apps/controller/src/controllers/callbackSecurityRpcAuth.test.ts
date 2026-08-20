import {
  createRpcSignatureHeader,
  deriveBoundRpcSignatureToken,
  rpcSignatureHeader
} from '@lowerdeck/rpc-signature';
import { createServer, Group, rpcMux } from '@lowerdeck/rpc-server';
import { serialize } from '@lowerdeck/serialize';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  claimCoreCallbackSecurityRequest,
  configureCoreCallbackSecurityReplayStoreForTest,
  coreCallbackSecurityContextHeader,
  coreCallbackSecurityKeyIdHeader,
  getCoreCallbackSecuritySignatureToken
} from './callbackSecurityRpcAuth';

let currentToken = 'core-callback-current-test-token';
let previousToken = 'core-callback-previous-test-token';
let handler = vi.fn(async (ctx: any) => ({
  actorId: ctx.coreCallbackSecurity.trustedActorId
}));
let app = new Group().controller({ protectedMutation: new Group().handler().do(handler) });
let rpc = rpcMux(
  {
    path: '/secure',
    getSignatureToken: getCoreCallbackSecuritySignatureToken,
    onVerifiedSignature: claimCoreCallbackSecurityRequest
  },
  [createServer({})(app)]
);

let context = (actorId = 'actor-authenticated') =>
  Buffer.from(
    JSON.stringify({
      version: 1,
      audience: 'subspace_callback_security',
      serviceActorId: 'metorial_core',
      trustedActorId: actorId,
      sourceRequestId: 'request-authenticated',
      sourceRequestIp: '192.0.2.40',
      sourceRequestUserAgent: 'core-auth-test'
    })
  ).toString('base64url');

let body = (name = 'protectedMutation') =>
  serialize.encode({ calls: [{ id: 'call-1', name, payload: {} }] });

let signedRequest = async (opts?: {
  encodedContext?: string;
  keyId?: 'current' | 'previous';
  signingRoot?: string;
  requestBody?: string;
}) => {
  let encodedContext = opts?.encodedContext ?? context();
  let keyId = opts?.keyId ?? 'current';
  let requestBody = opts?.requestBody ?? body();
  let root = opts?.signingRoot ?? (keyId === 'current' ? currentToken : previousToken);
  let secret = await deriveBoundRpcSignatureToken(root, encodedContext);
  let signature = await createRpcSignatureHeader({
    token: secret,
    timestamp: Date.now(),
    method: 'POST',
    url: 'https://subspace.test/secure?batch=1',
    body: requestBody
  });
  return new Request('https://subspace.test/secure?batch=1', {
    method: 'POST',
    headers: {
      'content-type': 'application/rpc+json',
      [coreCallbackSecurityContextHeader]: encodedContext,
      [coreCallbackSecurityKeyIdHeader]: keyId,
      [rpcSignatureHeader]: signature
    },
    body: requestBody
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUBSPACE_CORE_RPC_TOKEN_CURRENT = currentToken;
  process.env.SUBSPACE_CORE_RPC_TOKEN_PREVIOUS = previousToken;
  let claimed = new Set<string>();
  configureCoreCallbackSecurityReplayStoreForTest({
    async claim(key) {
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }
  });
});

afterEach(() => configureCoreCallbackSecurityReplayStoreForTest(null));

describe('Core callback-security RPC authentication', () => {
  test('denies unsigned and invalid calls before handler/controller lookup', async () => {
    let unsigned = new Request('https://subspace.test/secure?batch=1', {
      method: 'POST',
      headers: {
        'content-type': 'application/rpc+json',
        [coreCallbackSecurityContextHeader]: context(),
        [coreCallbackSecurityKeyIdHeader]: 'current'
      },
      body: body('handler-that-does-not-exist')
    });
    expect((await rpc.fetch(unsigned)).status).toBe(401);

    let invalid = await signedRequest({ signingRoot: 'forged-root-token' });
    expect((await rpc.fetch(invalid)).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test('derives trusted context from the authenticated header and denies forgery/replay', async () => {
    let valid = await signedRequest();
    expect((await rpc.fetch(valid.clone())).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(await handler.mock.results[0]!.value).toEqual({
      actorId: 'actor-authenticated'
    });

    expect((await rpc.fetch(valid.clone())).status).toBe(401);
    expect(handler).toHaveBeenCalledOnce();

    let forged = await signedRequest({
      encodedContext: context('actor-forged'),
      signingRoot: 'attacker-token'
    });
    expect((await rpc.fetch(forged)).status).toBe(401);
    expect(handler).toHaveBeenCalledOnce();
  });

  test('accepts the distinct previous credential during rotation', async () => {
    let response = await rpc.fetch(
      await signedRequest({ keyId: 'previous', signingRoot: previousToken })
    );
    expect(response.status).toBe(200);
    expect(currentToken).not.toBe(previousToken);
  });
});
