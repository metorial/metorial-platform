import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findManySkillTemplates: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillTemplate: {
      findMany: mocks.findManySkillTemplates
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {},
  getId: vi.fn(),
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {}
}));

vi.mock('../queues/reconcileSkillProviderLinks', () => ({
  reconcileSkillProviderLinksQueue: {
    add: vi.fn()
  }
}));

import { skillResourceService } from './resource';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findManySkillTemplates.mockResolvedValue([
    {
      id: 'skt_plain',
      storeId: 'str_legacy',
      storeTemplate: {
        id: 'stt_plain'
      },
      instance: null
    }
  ]);
});

describe('skillResourceService.hydrateSkillTemplates', () => {
  it('preserves the scoped backing store ID selected by the template service', async () => {
    let [template] = await skillResourceService.hydrateSkillTemplates([
      {
        id: 'skt_plain',
        storeTemplate: {
          storeId: 'str_scoped'
        }
      }
    ]);

    expect(template.storeId).toBe('str_scoped');
    expect(template.localSkillTemplate.storeId).toBe('str_scoped');
  });

  it('does not fall back to a legacy store when the scoped backing is unavailable', async () => {
    let [template] = await skillResourceService.hydrateSkillTemplates([
      {
        id: 'skt_plain',
        storeTemplate: {
          storeId: undefined
        }
      }
    ]);

    expect(template.storeId).toBeNull();
    expect(template.localSkillTemplate.storeId).toBeNull();
  });

  it('keeps the stored ID for unscoped hydration callers', async () => {
    let [template] = await skillResourceService.hydrateSkillTemplates([
      {
        id: 'skt_plain'
      }
    ]);

    expect(template.storeId).toBe('str_legacy');
  });
});
