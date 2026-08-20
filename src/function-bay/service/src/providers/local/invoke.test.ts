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

  it('falls back to the canonical function bundle when the runtime copy is missing', async () => {
    let zip = new JSZip();
    zip.file(
      'index.js',
      `
exports.handler = async () => ({
  statusCode: 200,
  body: { result: { source: 'canonical-bundle' } }
});
`
    );

    mocks.storage.getObject
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce({
        data: Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
      });
    mocks.encryption.decrypt.mockResolvedValue(JSON.stringify({}));

    let result = await invokeFunction({
      tenantId: 'tenant_123',
      functionVersion: { id: 'functionVersion_123' } as any,
      function: { id: 'function_123' } as any,
      sourceFunction: { id: 'function_123' } as any,
      functionBundle: {
        bucket: 'bundles',
        storageKey: 'bundles/canonical.zip'
      } as any,
      payload: {},
      providerData: {
        bucket: 'bundles',
        storageKey: 'local/provider/functionVersion_123.zip',
        handler: 'index.handler',
        runtimeIdentifier: 'local.nodejs22.x',
        encryptedEnvironmentVariables: 'encrypted-env'
      }
    });

    expect(mocks.storage.getObject).toHaveBeenNthCalledWith(
      1,
      'bundles',
      'local/provider/functionVersion_123.zip'
    );
    expect(mocks.storage.getObject).toHaveBeenNthCalledWith(
      2,
      'bundles',
      'bundles/canonical.zip'
    );
    expect(result).toMatchObject({
      type: 'success',
      result: { source: 'canonical-bundle' }
    });
  });
});
