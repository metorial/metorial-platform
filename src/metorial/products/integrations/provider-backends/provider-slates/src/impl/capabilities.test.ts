import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, slates } = vi.hoisted(() => ({
  db: { slateVersion: { findUniqueOrThrow: vi.fn() } },
  slates: { slateVersion: { get: vi.fn() }, slateSpecification: { get: vi.fn() } }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/provider-utils', async () => ({
  ...(await vi.importActual('@metorial-subspace/provider-utils/src/lib/schemaMarkers')),
  IProviderCapabilities: class {}
}));
vi.mock('../client', () => ({ slates }));

import { ProviderCapabilities } from './capabilities';

describe('trigger specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.slateVersion.findUniqueOrThrow.mockResolvedValue({
      id: 'version-1',
      slate: { id: 'slate-1' }
    });
    slates.slateVersion.get.mockResolvedValue({
      specification: { specificationId: 'spec-1' }
    });
    slates.slateSpecification.get.mockResolvedValue({
      id: 'spec-1',
      identifier: 'google/drive@1',
      key: 'google-drive',
      name: 'Google Drive',
      providerInfo: { description: null, metadata: null },
      configSchema: { type: 'object' },
      triggers: [
        {
          id: 'trigger-1',
          identifier: 'google/drive@1/file_changed',
          key: 'file_changed',
          name: 'File changed',
          description: null,
          inputSchema: { type: 'object' },
          outputSchema: {
            type: 'object',
            properties: {
              fileId: { type: 'string', 'x-slates-event-attribute': true },
              name: { type: 'string', 'x-slates-internal': 'value' }
            }
          },
          triggerGroup: {
            key: 'file_events',
            invocation: { type: 'polling', intervalSeconds: 60 }
          }
        }
      ],
      triggerGroups: [],
      authMethods: [],
      tools: []
    });
  });

  it('hands the trigger output schema to the platform with platform markers', async () => {
    let res = await new ProviderCapabilities({} as any).getSpecificationForProviderVersion({
      providerVersion: { slateVersionOid: 1n }
    } as any);

    let expected = {
      type: 'object',
      properties: {
        fileId: { type: 'string', 'x-metorial-event-attribute': true },
        name: { type: 'string' }
      }
    };

    if (res.status !== 'success') throw new Error('Expected a specification');
    expect(res.triggers.map(trigger => trigger.outputJsonSchema)).toEqual([expected]);
    expect(res.specification.triggers.map(trigger => trigger.outputJsonSchema)).toEqual([
      expected
    ]);
  });
});
