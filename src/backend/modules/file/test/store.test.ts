import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(factory => ({
      run: factory()
    }))
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/services/scope', () => ({
  resolveCargoScopeForOwner: vi.fn()
}));

vi.mock('../src/services/documentParticipant', () => ({
  documentParticipantService: {
    enrichActors: vi.fn()
  }
}));

vi.mock('../src/cargo', () => ({
  cargo: {
    actor: {
      upsert: vi.fn()
    },
    store: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      modifyItems: vi.fn()
    },
    storeItem: {
      get: vi.fn(),
      list: vi.fn()
    },
    storeParticipant: {
      get: vi.fn(),
      list: vi.fn()
    }
  }
}));

import { cargo } from '../src/cargo';
import { documentParticipantService } from '../src/services/documentParticipant';
import { resolveCargoScopeForOwner } from '../src/services/scope';
import { storeItemService } from '../src/services/storeItem';
import { storeParticipantService } from '../src/services/storeParticipant';
import { storeService } from '../src/services/store';

let owner = {
  type: 'instance' as const,
  organization: {
    id: 'org_1',
    oid: 11n
  },
  instance: {
    id: 'ins_1',
    oid: 22n
  }
};

let scope = {
  tenantId: 'ten_1',
  environmentId: 'env_1'
};

describe('file store services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCargoScopeForOwner).mockResolvedValue(scope as any);
  });

  it('forwards store crud and modify requests through cargo scope', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_1'
    } as any);
    vi.mocked(cargo.store.create).mockResolvedValue({
      id: 'sto_1'
    } as any);
    vi.mocked(cargo.store.list).mockResolvedValue({
      items: [{ id: 'sto_1' }],
      pagination: {
        has_more_after: true,
        has_more_before: false
      }
    } as any);
    vi.mocked(cargo.store.get).mockResolvedValue({
      id: 'sto_1'
    } as any);
    vi.mocked(cargo.store.update).mockResolvedValue({
      id: 'sto_1',
      name: 'Renamed'
    } as any);
    vi.mocked(cargo.store.delete).mockResolvedValue({
      id: 'sto_1'
    } as any);
    vi.mocked(cargo.store.modifyItems).mockResolvedValue([
      {
        type: 'add',
        item: {
          id: 'sti_1'
        }
      }
    ] as any);

    await storeService.createStore({
      owner: owner as any,
      input: {
        name: 'Assets'
      }
    });
    let paginator = await storeService.listStores({
      owner: owner as any
    });
    await paginator.run({
      limit: 10
    } as any);
    let store = await storeService.getStoreById({
      owner: owner as any,
      storeId: 'sto_1'
    });
    await storeService.updateStore({
      owner: owner as any,
      store: store as any,
      input: {
        name: 'Renamed'
      }
    });
    await storeService.deleteStore({
      owner: owner as any,
      store: store as any
    });
    await storeService.modifyStoreItems({
      owner: owner as any,
      store: store as any,
      accessActor: {
        identifier: 'organization_actor:ora_1',
        organizationActorId: 'ora_1',
        name: 'Editor'
      },
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true,
      operations: [
        {
          type: 'add',
          path: '/notes',
          documentId: 'doc_1'
        }
      ]
    });

    expect(cargo.store.create).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: undefined,
      name: 'Assets'
    });
    expect(cargo.store.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      limit: 10
    });
    expect(cargo.store.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_1'
    });
    expect(cargo.store.update).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_1',
      name: 'Renamed'
    });
    expect(cargo.store.delete).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_1'
    });
    expect(cargo.actor.upsert).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      identifier: 'organization_actor:ora_1',
      name: 'Editor',
      organizationActorId: 'ora_1',
      consumerProfileId: undefined
    });
    expect(cargo.store.modifyItems).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_1',
      operations: [
        {
          type: 'add',
          path: '/notes',
          documentId: 'doc_1'
        }
      ],
      actorId: 'act_1',
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
  });

  it('uses consumer actors for access-controlled store reads', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_con_1'
    } as any);
    vi.mocked(cargo.store.get).mockResolvedValue({
      id: 'sto_consumer'
    } as any);
    vi.mocked(cargo.store.list).mockResolvedValue({
      items: [{ id: 'sto_consumer' }],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    } as any);

    await storeService.getStoreById({
      owner: owner as any,
      storeId: 'sto_consumer',
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer'
      }
    });
    let paginator = await storeService.listStores({
      owner: owner as any,
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer'
      }
    });
    await paginator.run({
      limit: 5
    } as any);

    expect(cargo.actor.upsert).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      identifier: 'consumer:con_1',
      name: 'Portal Consumer',
      organizationActorId: undefined,
      consumerProfileId: undefined
    });
    expect(cargo.store.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_consumer',
      actorId: 'act_con_1',
      defaultPermissions: undefined,
      overridePermissions: undefined
    });
    expect(cargo.store.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      actorId: 'act_con_1',
      defaultPermissions: undefined,
      overridePermissions: undefined,
      limit: 5
    });
  });

  it('lists and gets nested store items through cargo', async () => {
    vi.mocked(cargo.storeItem.get).mockResolvedValue({
      id: 'sti_1'
    } as any);
    vi.mocked(cargo.storeItem.list).mockResolvedValue({
      items: [{ id: 'sti_1' }],
      pagination: {
        has_more_after: false,
        has_more_before: true
      }
    } as any);

    await storeItemService.getStoreItemById({
      owner: owner as any,
      itemId: 'sti_1'
    });
    let paginator = await storeItemService.listStoreItems({
      owner: owner as any,
      storeId: 'sto_1'
    });
    let result = await paginator.run({
      limit: 5
    } as any);

    expect(cargo.storeItem.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      itemId: 'sti_1',
      actorId: undefined,
      defaultPermissions: undefined,
      overridePermissions: undefined
    });
    expect(cargo.storeItem.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_1',
      fileId: undefined,
      documentId: undefined,
      actorId: undefined,
      defaultPermissions: undefined,
      overridePermissions: undefined,
      limit: 5
    });
    expect(result.pagination).toEqual({
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  it('enriches store participants through the shared actor enricher', async () => {
    vi.mocked(documentParticipantService.enrichActors).mockResolvedValue([
      {
        name: 'Member Name',
        organizationActor: null,
        consumerProfile: null
      }
    ] as any);
    vi.mocked(cargo.storeParticipant.get).mockResolvedValue({
      id: 'stp_1',
      storeId: 'sto_1',
      permissions: ['content_read'],
      actor: {
        name: 'Cargo Actor'
      },
      createdAt: new Date('2026-05-09T12:00:00.000Z')
    } as any);
    vi.mocked(cargo.storeParticipant.list).mockResolvedValue({
      items: [
        {
          id: 'stp_1',
          storeId: 'sto_1',
          permissions: ['content_read'],
          actor: {
            name: 'Cargo Actor'
          },
          createdAt: new Date('2026-05-09T12:00:00.000Z')
        }
      ],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    } as any);

    let participant = await storeParticipantService.getStoreParticipantById({
      owner: owner as any,
      storeParticipantId: 'stp_1'
    });
    let paginator = await storeParticipantService.listStoreParticipants({
      owner: owner as any,
      storeId: 'sto_1'
    });
    let result = await paginator.run({} as any);

    expect(documentParticipantService.enrichActors).toHaveBeenCalled();
    expect(participant.actor.name).toBe('Member Name');
    expect(result.items[0]?.actor.name).toBe('Member Name');
    expect(cargo.storeParticipant.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      storeId: 'sto_1'
    });
  });
});
