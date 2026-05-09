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

vi.mock('@metorial/db', () => ({}));

vi.mock('../src/definitions', () => ({
  purposes: {}
}));

vi.mock('../src/cargo', () => ({
  cargo: {
    actor: {
      upsert: vi.fn()
    },
    file: {
      get: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  },
  reconcileCargoPurposes: vi.fn()
}));

vi.mock('../src/services/fileReference', () => ({
  fileReferenceService: {
    getFileReferenceById: vi.fn(),
    listFileReferences: vi.fn()
  }
}));

import { cargo } from '../src/cargo';
import { fileService } from '../src/services/file';
import { resolveCargoScopeForOwner } from '../src/services/scope';

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

describe('file services access forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCargoScopeForOwner).mockResolvedValue(scope as any);
  });

  it('gives member reads unconditional cargo permissions', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_member'
    } as any);
    vi.mocked(cargo.file.get).mockResolvedValue({
      id: 'fil_1',
      status: 'uploaded',
      purpose: 'document',
      references: []
    } as any);
    vi.mocked(cargo.file.list).mockResolvedValue({
      items: [],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    } as any);

    await fileService.getFileById({
      owner: owner as any,
      fileId: 'fil_1',
      accessActor: {
        identifier: 'organization_actor:ora_1',
        organizationActorId: 'ora_1',
        name: 'Member Name'
      },
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
    let paginator = await fileService.listFiles({
      owner: owner as any,
      accessActor: {
        identifier: 'organization_actor:ora_1',
        organizationActorId: 'ora_1',
        name: 'Member Name'
      },
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
    await paginator.run({
      limit: 5
    } as any);

    expect(cargo.actor.upsert).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      identifier: 'organization_actor:ora_1',
      name: 'Member Name',
      organizationActorId: 'ora_1',
      consumerProfileId: undefined
    });
    expect(cargo.file.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileId: 'fil_1',
      actorId: 'act_member',
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
    expect(cargo.file.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      purpose: undefined,
      actorId: 'act_member',
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true,
      limit: 5
    });
  });

  it('uses consumer actors without implicit permission overrides', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_consumer'
    } as any);
    vi.mocked(cargo.file.get).mockResolvedValue({
      id: 'fil_2',
      status: 'uploaded',
      purpose: 'document',
      references: []
    } as any);
    vi.mocked(cargo.file.list).mockResolvedValue({
      items: [],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    } as any);

    await fileService.getFileById({
      owner: owner as any,
      fileId: 'fil_2',
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer'
      }
    });
    let paginator = await fileService.listFiles({
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
    expect(cargo.file.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileId: 'fil_2',
      actorId: 'act_consumer',
      defaultPermissions: undefined,
      overridePermissions: undefined
    });
    expect(cargo.file.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      purpose: undefined,
      actorId: 'act_consumer',
      defaultPermissions: undefined,
      overridePermissions: undefined,
      limit: 5
    });
  });
});
