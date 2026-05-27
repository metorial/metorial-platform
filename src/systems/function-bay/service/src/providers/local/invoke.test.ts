import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  storage: {
    getObject: vi.fn()
  },
  encryption: {
    decrypt: vi.fn()
  }
}));

vi.mock('../../env', () => ({
  env: {
    provider: {
      DEFAULT_PROVIDER: 'local'
    }
  }
}));

vi.mock('../../storage', () => ({
  storage: mocks.storage
}));

vi.mock('../../encryption', () => ({
  encryption: mocks.encryption
}));

import { invokeFunction } from './invoke';

describe('local provider invoke', () => {
  beforeEach(() => {
    mocks.storage.getObject.mockReset();
    mocks.encryption.decrypt.mockReset();
  });

  it('invokes a lambda-compatible bundle locally', async () => {
    let zip = new JSZip();
    zip.file(
      'index.js',
      `
exports.handler = async event => {
  console.log('local invocation start');
  return {
    statusCode: 200,
    body: {
      result: {
        echoed: event.payload.value
      }
    }
  };
};
`
    );

    mocks.storage.getObject.mockResolvedValue({
      data: Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
    });
    mocks.encryption.decrypt.mockResolvedValue(JSON.stringify({ TEST_FLAG: 'enabled' }));

    let result = await invokeFunction({
      tenantId: 'tenant_123',
      functionVersion: { id: 'functionVersion_123' } as any,
      function: { id: 'function_123' } as any,
      sourceFunction: { id: 'function_123' } as any,
      payload: { value: 'hello' },
      providerData: {
        bucket: 'bundles',
        storageKey: 'local/provider/functionVersion_123.zip',
        handler: 'index.handler',
        runtimeIdentifier: 'local.nodejs22.x',
        encryptedEnvironmentVariables: 'encrypted-env'
      }
    });

    expect(result).toMatchObject({
      type: 'success',
      result: {
        echoed: 'hello'
      },
      computeTimeMs: expect.any(Number),
      billedTimeMs: expect.any(Number)
    });
    expect(result.logs).toEqual(
      expect.arrayContaining([
        [expect.any(Number), expect.stringContaining('local invocation start')]
      ])
    );
  });
});
