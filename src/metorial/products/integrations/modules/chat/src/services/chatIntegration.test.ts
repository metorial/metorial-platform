import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx, ensureAdapterIntegration, applyAdapterIntegrationPresentation } = vi.hoisted(
  () => {
    let createModel = () => ({
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    });

    return {
      tx: {
        chatIntegration: createModel(),
        adapterIntegration: createModel()
      },
      ensureAdapterIntegration: vi.fn(),
      applyAdapterIntegrationPresentation: vi.fn()
    };
  }
);

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: tx,
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 600n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx),
  addAfterTransactionHook: async (hook: () => any) => await hook()
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} }))
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 2 })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  ensureAdapterIntegration,
  applyAdapterIntegrationPresentation,
  removeAdapterIntegration: vi.fn(),
  resolveAdapterGlobal: vi.fn(async () => ({ oid: 9n, identifier: 'chat' }))
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { chatIntegration: { id: 'idx' }, chatIntegrationInstance: { id: 'idx2' } },
  voyagerSource: Promise.resolve({ id: 'src' })
}));

vi.mock('../queues/lifecycle', () => ({
  enqueueChatIntegrationArchived: vi.fn(),
  enqueueChatIntegrationCreated: vi.fn(),
  enqueueChatIntegrationUpdated: vi.fn(),
  enqueueChatIntegrationInstanceArchived: vi.fn(),
  enqueueChatIntegrationInstanceCreated: vi.fn(),
  enqueueChatIntegrationInstanceUpdated: vi.fn()
}));

vi.mock('../lib/project', () => ({
  archiveChatIntegrationProjection: vi.fn(),
  getSlug: (name: string) => `slug-${name}`,
  projectChatFromAdapterIntegration: vi.fn()
}));

import { chatIntegrationService } from './chatIntegration';

let tenant = { oid: 1n, projectOid: 11n } as any;
let environment = { oid: 3n, instanceOid: 33n } as any;

describe('chatIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureAdapterIntegration.mockResolvedValue({
      oid: 100n,
      tenantOid: 1n,
      projectOid: 11n,
      environmentOid: 3n,
      instanceOid: 33n,
      solutionOid: 2,
      integration: { name: 'Support', description: '', metadata: {} }
    });
    tx.chatIntegration.findUnique.mockResolvedValue(null);
    tx.chatIntegration.create.mockResolvedValue({
      oid: 600n,
      name: 'Support',
      adapterIntegration: { isStandalone: true }
    });
    tx.chatIntegration.update.mockResolvedValue({
      oid: 600n,
      name: 'Renamed',
      adapterIntegration: { isStandalone: true, oid: 100n }
    });
  });

  it('creates a standalone chat integration through adapter primitives', async () => {
    await chatIntegrationService.createChatIntegrationInternal({
      tenant,
      environment,
      mode: 'standalone',
      input: { name: 'Support', description: 'hello', metadata: { a: 1 } }
    });

    expect(ensureAdapterIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        isStandalone: true,
        type: 'chat',
        presentation: { name: 'Support' }
      })
    );
    expect(tx.chatIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Support',
          description: 'hello'
        })
      })
    );
  });

  it('copies standalone name updates through applyAdapterIntegrationPresentation', async () => {
    await chatIntegrationService.updateChatIntegrationInternal({
      tenant,
      environment,
      chatIntegration: {
        oid: 600n,
        name: 'Support',
        description: 'hello',
        metadata: {},
        privateMetadata: {},
        tenantOid: 1n,
        adapterIntegrationOid: 100n
      } as any,
      input: { name: 'Renamed' }
    });

    expect(applyAdapterIntegrationPresentation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed' })
    );
  });
});
