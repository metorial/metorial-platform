import { InvokeCommand } from '@aws-sdk/client-lambda';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mocks = vi.hoisted(() => ({
  lambdaClient: {
    send: vi.fn()
  },
  createDeflectorToken: vi.fn(),
  createLegacyDeflectorToken: vi.fn(),
  getDeflectorProxyUrl: vi.fn()
}));

vi.mock('./lambda', () => ({
  lambdaClient: mocks.lambdaClient
}));

vi.mock('./deflector', () => ({
  createDeflectorToken: mocks.createDeflectorToken,
  createLegacyDeflectorToken: mocks.createLegacyDeflectorToken,
  getDeflectorProxyUrl: mocks.getDeflectorProxyUrl
}));

import { invokeFunction } from './invoke';

describe('aws lambda deflector invocation token selection', () => {
  beforeEach(() => {
    mocks.lambdaClient.send.mockReset();
    mocks.createDeflectorToken.mockReset();
    mocks.createLegacyDeflectorToken.mockReset();
    mocks.getDeflectorProxyUrl.mockReset();

    mocks.getDeflectorProxyUrl.mockReturnValue('http://deflector.local:8080');
    mocks.createDeflectorToken.mockResolvedValue('v2-token');
    mocks.createLegacyDeflectorToken.mockResolvedValue('legacy-token');
    mocks.lambdaClient.send.mockResolvedValue({
      Payload: new TextEncoder().encode(
        JSON.stringify({ statusCode: 200, body: { result: { ok: true } } })
      )
    });
  });

  let invoke = async (supportsV2Proxy: boolean) =>
    await invokeFunction({
      tenantId: 'tenant_123',
      function: { id: 'function_123' } as any,
      sourceFunction: { id: 'function_123' } as any,
      functionVersion: {
        id: 'functionVersion_123',
        supportsV2Proxy
      } as any,
      payload: { value: 'hello' },
      providerData: {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:lambda-name',
        functionName: 'lambda-name'
      }
    });

  let invocationPayload = () => {
    let command = mocks.lambdaClient.send.mock.calls[0]?.[0] as InvokeCommand;
    return JSON.parse(new TextDecoder().decode((command as any).input.Payload));
  };

  it('uses a V2 token for V2-capable function versions', async () => {
    await invoke(true);

    expect(mocks.createDeflectorToken).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_123',
        functionId: 'function_123',
        functionVersionId: 'functionVersion_123'
      })
    );
    expect(mocks.createLegacyDeflectorToken).not.toHaveBeenCalled();
    expect(invocationPayload().__functionBay.deflector.token).toBe('v2-token');
  });

  it('uses a legacy fallback token for old function versions', async () => {
    await invoke(false);

    expect(mocks.createDeflectorToken).not.toHaveBeenCalled();
    expect(mocks.createLegacyDeflectorToken).toHaveBeenCalledOnce();
    expect(invocationPayload().__functionBay.deflector.token).toBe('legacy-token');
  });
});
