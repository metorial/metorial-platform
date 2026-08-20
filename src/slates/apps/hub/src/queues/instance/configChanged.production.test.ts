import { computeSlateConfigSchemaV2Hash } from '@slates/proto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { dbMock, invocationMock } = vi.hoisted(() => ({
  dbMock: {
    slateInstanceConfig: { findUnique: vi.fn(), updateMany: vi.fn() },
    slateVersion: { findUnique: vi.fn() }
  },
  invocationMock: { createInvocation: vi.fn(), sendUpdatedConfig: vi.fn() }
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: () => ({ process: (handler: unknown) => handler })
}));
vi.mock('../../db', () => ({ db: dbMock }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unit.test' } } }));
vi.mock('../../services', () => ({
  slateErrorService: { recordSlateError: vi.fn(async () => {}) },
  slateInvocationService: invocationMock
}));

import { processSlateInstanceConfigChanged } from './configChanged';

let fields = {
  endpoint: { visibility: 'plain' as const, lifecycle: 'none' as const },
  token: { visibility: 'secret' as const, lifecycle: 'projection' as const }
};
let jsonSchema = {
  type: 'object',
  properties: {
    endpoint: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
      additionalProperties: false
    },
    token: { type: 'string' }
  },
  additionalProperties: false
};
let schema = {
  version: 2,
  descriptorHash: computeSlateConfigSchemaV2Hash({
    version: 2,
    fieldOrder: Object.keys(fields).sort(),
    fields,
    jsonSchema
  }),
  fields,
  schema: jsonSchema
};
let config = {
  oid: 1n,
  id: 'config-1',
  tenantOid: 2n,
  generation: 3,
  value: { endpoint: { url: 'https://old.test' }, token: { configured: true } },
  schema,
  instance: { oid: 4n, slateOid: 5n }
};
let job = {
  newConfigId: 'config-1',
  versionId: 'version-1',
  configGeneration: 3,
  configSchemaHash: schema.descriptorHash
};

beforeEach(() => {
  vi.resetAllMocks();
  dbMock.slateInstanceConfig.findUnique.mockResolvedValue(config);
  dbMock.slateVersion.findUnique.mockResolvedValue({ oid: 6n, id: 'version-1' });
  invocationMock.createInvocation.mockResolvedValue({ id: 'stack' });
  dbMock.slateInstanceConfig.updateMany.mockResolvedValue({ count: 1 });
});

describe('production configChanged queue call graph', () => {
  it('projects canonical presence and rejects wrong nested provider output before persistence', async () => {
    invocationMock.sendUpdatedConfig.mockResolvedValue({
      status: 'success',
      data: { success: true, config: { endpoint: { url: 42 } } },
      invocation: { oid: 8n, id: 'invocation-1' }
    });
    await processSlateInstanceConfigChanged(job);
    expect(invocationMock.createInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalConfigSchema: expect.objectContaining({ hash: schema.descriptorHash })
      })
    );
    expect(invocationMock.sendUpdatedConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        newConfig: {
          endpoint: { url: 'https://old.test' },
          token: { configured: true }
        }
      })
    );
    expect(dbMock.slateInstanceConfig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'invalid_config_provider_output' })
      })
    );
    expect(dbMock.slateInstanceConfig.updateMany.mock.calls[0]![0].data).not.toHaveProperty(
      'value'
    );
  });

  it('persists only independently validated declared plain output under generation CAS', async () => {
    invocationMock.sendUpdatedConfig.mockResolvedValue({
      status: 'success',
      data: { success: true, config: { endpoint: { url: 'https://normalized.test' } } },
      invocation: { oid: 8n, id: 'invocation-2' }
    });
    await processSlateInstanceConfigChanged(job);
    expect(dbMock.slateInstanceConfig.updateMany).toHaveBeenCalledWith({
      where: { oid: 1n, generation: 3 },
      data: {
        value: {
          endpoint: { url: 'https://normalized.test' },
          token: { configured: true }
        },
        errorCode: null,
        errorMessage: null,
        errorInvocationId: null
      }
    });
  });
});
