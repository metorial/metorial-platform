import { InvokeCommand } from '@aws-sdk/client-lambda';
import { importJWK, jwtVerify } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  lambdaClient: {
    send: vi.fn()
  },
  env: {
    runtime: {
      RUNTIME_SIGNING_KEY: 'rVlw-_wVKiJ0kZPE9IHiWhxxzRC4eEEsi8jb0XD8M_Q',
      RUNTIME_SIGNING_KEY_ID: undefined as string | undefined
    },
    egressGateway: {
      EGRESS_GATEWAY_PROXY_URL: 'http://egress-gateway.local:8080' as string | undefined
    }
  }
}));

vi.mock('./lambda', () => ({
  lambdaClient: mocks.lambdaClient
}));

vi.mock('../../env', () => ({
  env: mocks.env
}));

import { getRuntimeSigningKey } from '../../lib/invocationCredentials';
import { invokeFunction } from './invoke';

let functionBayPublicKey = '7pxCkiayOQjmRbz8C9yTH2mQ-9lNPQ48PsT2qye7Dtg';

let verifyGrant = async (token: string) =>
  (
    await jwtVerify(
      token,
      await importJWK({ kty: 'OKP', crv: 'Ed25519', x: functionBayPublicKey }, 'EdDSA'),
      { audience: 'metorial-egress', issuer: 'function-bay' }
    )
  ).payload;

describe('aws lambda egress grants', () => {
  beforeEach(() => {
    mocks.lambdaClient.send.mockReset();
    mocks.env.egressGateway.EGRESS_GATEWAY_PROXY_URL = 'http://egress-gateway.local:8080';
    mocks.lambdaClient.send.mockResolvedValue({
      Payload: new TextEncoder().encode(
        JSON.stringify({ statusCode: 200, body: { result: { ok: true } } })
      )
    });
  });

  let invoke = async (d: {
    supportsV2Proxy: boolean;
    configuration?: Partial<PrismaJson.FunctionConfiguration>;
    egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
    sourceFunctionId?: string;
  }) =>
    await invokeFunction({
      invocationId: 'functionInvocation_123',
      tenantId: 'tenant_123',
      function: { id: 'function_123' } as any,
      sourceFunction: { id: d.sourceFunctionId ?? 'function_123' } as any,
      functionVersion: {
        id: 'functionVersion_123',
        supportsV2Proxy: d.supportsV2Proxy,
        configuration: { memorySizeMb: 256, timeoutSeconds: 30, ...d.configuration }
      } as any,
      enclave: { id: 'enclave_123', identifier: 'preview' },
      payload: { value: 'hello' },
      egressPolicy: d.egressPolicy,
      providerData: {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:lambda-name',
        functionName: 'lambda-name'
      }
    });

  let invocationPayload = () => {
    let command = mocks.lambdaClient.send.mock.calls[0]?.[0] as InvokeCommand;
    return JSON.parse(new TextDecoder().decode((command as any).input.Payload));
  };

  it('derives the vector kid from the configured seed', () => {
    expect(getRuntimeSigningKey()?.kid).toBe('c1facaa9927914a9');
  });

  it('sends a gateway grant in the fields existing wrappers read', async () => {
    let result = await invoke({
      supportsV2Proxy: true,
      egressPolicy: {
        direction: 'egress',
        entries: [{ cidr: '203.0.113.10/32', portRange: { from: 443, to: 443 } }]
      }
    });

    expect(result.type).toBe('success');
    expect(invocationPayload().payload).toEqual({ value: 'hello' });

    let { proxyUrl, token } = invocationPayload().__functionBay.deflector;
    expect(proxyUrl).toBe('http://egress-gateway.local:8080');

    let claims = await verifyGrant(token);
    expect(claims).toMatchObject({
      jti: 'functionInvocation_123',
      tenantId: 'tenant_123',
      functionId: 'function_123',
      functionVersionId: 'functionVersion_123',
      enclaveId: 'enclave_123',
      enclaveIdentifier: 'preview',
      source: 'lambda',
      policy: { entries: [{ cidr: '203.0.113.10/32', portRange: { from: 443, to: 443 } }] }
    });
    expect(claims.allowAll).toBeUndefined();
    expect(claims.effectiveFunctionId).toBeUndefined();
    expect(claims.exp! - claims.iat!).toBe(90);
  });

  it('records the enclave override function as the effective function', async () => {
    await invoke({ supportsV2Proxy: true, sourceFunctionId: 'function_source' });

    let claims = await verifyGrant(invocationPayload().__functionBay.deflector.token);
    expect(claims.functionId).toBe('function_source');
    expect(claims.effectiveFunctionId).toBe('function_123');
  });

  it('gives old function versions an allow-all grant instead of a legacy token', async () => {
    await invoke({ supportsV2Proxy: false });

    let claims = await verifyGrant(invocationPayload().__functionBay.deflector.token);
    expect(claims.allowAll).toBe(true);
    expect(claims.policy).toBeUndefined();
    expect(claims.legacyFallback).toBeUndefined();
  });

  it('maps disableNetworkIsolation to allowAll', async () => {
    await invoke({ supportsV2Proxy: true, configuration: { disableNetworkIsolation: true } });

    let claims = await verifyGrant(invocationPayload().__functionBay.deflector.token);
    expect(claims.allowAll).toBe(true);
  });

  it('omits the gateway fields when no gateway is configured', async () => {
    mocks.env.egressGateway.EGRESS_GATEWAY_PROXY_URL = undefined;

    await invoke({ supportsV2Proxy: true });

    expect(invocationPayload().__functionBay).toBeUndefined();
  });
});
