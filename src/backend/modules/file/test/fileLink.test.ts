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

vi.mock('../src/cargo', () => ({
  cargo: {
    actor: {
      upsert: vi.fn()
    },
    fileLink: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      getByKey: vi.fn()
    }
  }
}));

vi.mock('../src/services/fileReference', () => ({
  fileReferenceService: {
    hasReferences: vi.fn()
  }
}));

import { cargo } from '../src/cargo';
import { fileLinkService } from '../src/services/fileLink';
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

describe('file link services access forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCargoScopeForOwner).mockResolvedValue(scope as any);
  });

  it('uses consumer actors for owned file-link reads, creates, lists, and deletes', async () => {
    vi.mocked(cargo.actor.upsert).mockResolvedValue({
      id: 'act_consumer'
    } as any);
    vi.mocked(cargo.fileLink.create).mockResolvedValue({
      id: 'lnk_1'
    } as any);
    vi.mocked(cargo.fileLink.get).mockResolvedValue({
      id: 'lnk_1'
    } as any);
    vi.mocked(cargo.fileLink.list).mockResolvedValue({
      items: [{ id: 'lnk_1' }],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    } as any);
    vi.mocked(cargo.fileLink.delete).mockResolvedValue({
      id: 'lnk_1'
    } as any);

    await fileLinkService.createFileLink({
      owner: owner as any,
      file: {
        id: 'fil_1'
      } as any,
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer',
        consumerId: 'con_1'
      },
      input: {
        expiresAt: new Date('2026-05-09T12:00:00.000Z')
      }
    });
    await fileLinkService.getFileLinkById({
      owner: owner as any,
      fileLinkId: 'lnk_1',
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer',
        consumerId: 'con_1'
      }
    });
    let paginator = await fileLinkService.listFileLinks({
      owner: owner as any,
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer',
        consumerId: 'con_1'
      }
    });
    await paginator.run({
      limit: 5
    } as any);
    await fileLinkService.deleteFileLink({
      owner: owner as any,
      fileLink: {
        id: 'lnk_1'
      } as any,
      accessActor: {
        identifier: 'consumer:con_1',
        name: 'Portal Consumer',
        consumerId: 'con_1'
      }
    });

    expect(cargo.actor.upsert).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      identifier: 'consumer:con_1',
      name: 'Portal Consumer',
      organizationActorId: undefined,
      consumerId: 'con_1'
    });
    expect(cargo.fileLink.create).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileId: 'fil_1',
      expiresAt: new Date('2026-05-09T12:00:00.000Z'),
      actorId: 'act_consumer'
    });
    expect(cargo.fileLink.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileLinkId: 'lnk_1',
      actorId: 'act_consumer'
    });
    expect(cargo.fileLink.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileId: undefined,
      actorId: 'act_consumer',
      limit: 5
    });
    expect(cargo.fileLink.delete).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileLinkId: 'lnk_1'
    });
  });

  it('keeps non-consumer file-link access organization-scoped', async () => {
    vi.mocked(cargo.fileLink.get).mockResolvedValue({
      id: 'lnk_2'
    } as any);
    vi.mocked(cargo.fileLink.list).mockResolvedValue({
      items: [{ id: 'lnk_2' }],
      pagination: {
        has_more_after: false,
        has_more_before: false
      }
    } as any);

    await fileLinkService.getFileLinkById({
      owner: owner as any,
      fileLinkId: 'lnk_2'
    });
    let paginator = await fileLinkService.listFileLinks({
      owner: owner as any
    });
    await paginator.run({
      limit: 3
    } as any);

    expect(cargo.actor.upsert).not.toHaveBeenCalled();
    expect(cargo.fileLink.get).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileLinkId: 'lnk_2',
      actorId: undefined
    });
    expect(cargo.fileLink.list).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      environmentId: 'env_1',
      fileId: undefined,
      actorId: undefined,
      limit: 3
    });
  });
});
