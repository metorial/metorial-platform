import { createRpcSignatureHeader, rpcSignatureHeader } from '@lowerdeck/rpc-signature';
import { Group, rpcMux } from '@lowerdeck/rpc-server';
import { serialize } from '@lowerdeck/serialize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../env';
import {
  claimSlatesHubSecretRpcRequest,
  configureSlatesHubSecretReplayStoreForTest,
  getSlatesHubSecretRpcSignatureToken,
  slatesHubSecretKeyIdHeader
} from './slateTriggerReceiverSecretRpcAuth';
import { createServer } from '@lowerdeck/rpc-server';

let currentToken = 'hub-subspace-current-test-token';
let previousToken = 'hub-subspace-previous-test-token';
let url = 'https://hub.example/slates-hub-secrets/mutate';

let signedRequest = async (keyId: 'current' | 'previous', token: string, body: string) => {
  let signature = await createRpcSignatureHeader({
    token,
    timestamp: Date.now(),
    method: 'POST',
    url,
    body
  });
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/rpc+json',
      [slatesHubSecretKeyIdHeader]: keyId,
      [rpcSignatureHeader]: signature
    },
    body
  });
};

describe('Hub Subspace secret RPC authentication and replay', () => {
  let claimed = new Set<string>();
  let mutation = vi.fn(async () => ({ mutated: true }));

  beforeEach(() => {
    env.slates.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT = currentToken;
    env.slates.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_PREVIOUS = previousToken;
    claimed = new Set();
    mutation.mockClear();
    configureSlatesHubSecretReplayStoreForTest({
      claim: async key => {
        if (claimed.has(key)) return false;
        claimed.add(key);
        return true;
      }
    });
  });

  afterEach(() => configureSlatesHubSecretReplayStoreForTest(null));

  let createApi = () => {
    let app = new Group<{ serviceActorId: string }>().controller({
      mutate: new Group<{ serviceActorId: string }>()
        .handler()
        .do(async ctx => ({ ...(await mutation()), serviceActorId: ctx.serviceActorId }))
    });
    return rpcMux(
      {
        path: '/slates-hub-secrets',
        getSignatureToken: getSlatesHubSecretRpcSignatureToken,
        onVerifiedSignature: claimSlatesHubSecretRpcRequest
      },
      [createServer({})(app)]
    );
  };

  it.each([
    ['current', currentToken],
    ['previous', previousToken]
  ] as const)(
    'accepts the %s rotation key and derives the Subspace actor',
    async (keyId, token) => {
      let api = createApi();
      let body = serialize.encode({ mutation: 'rotate-receiver-secret' });
      let response = await api.fetch(await signedRequest(keyId, token, body));
      let output = serialize.decode(await response.text()) as any;

      expect(response.status).toBe(200);
      expect(output).toEqual({ mutated: true, serviceActorId: 'subspace_callback_security' });
      expect(mutation).toHaveBeenCalledOnce();
    }
  );

  it('rejects a replay before the mutation handler is looked up or invoked', async () => {
    let api = createApi();
    let body = serialize.encode({ mutation: 'consume-receiver-receipt' });
    let first = await signedRequest('current', currentToken, body);
    let signature = first.headers.get(rpcSignatureHeader)!;

    expect((await api.fetch(first)).status).toBe(200);
    let replay = new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/rpc+json',
        [slatesHubSecretKeyIdHeader]: 'current',
        [rpcSignatureHeader]: signature
      },
      body
    });
    expect((await api.fetch(replay)).status).toBe(401);
    expect(mutation).toHaveBeenCalledOnce();
  });

  it('rejects missing, unsupported, and mismatched credentials before mutation', async () => {
    let api = createApi();
    let body = serialize.encode({ mutation: 'revoke-receiver-secret' });
    let unsigned = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/rpc+json' },
      body
    });
    expect((await api.fetch(unsigned)).status).toBe(401);

    let invalidKey = await signedRequest('current', currentToken, body);
    invalidKey.headers.set(slatesHubSecretKeyIdHeader, 'unsupported');
    expect((await api.fetch(invalidKey)).status).toBe(401);

    let invalidToken = await signedRequest('current', previousToken, body);
    expect((await api.fetch(invalidToken)).status).toBe(401);
    expect(mutation).not.toHaveBeenCalled();
  });
});
