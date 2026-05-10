import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tenantUpsert, environmentUpsert, actorUpsert, uploadFileMock } = vi.hoisted(() => ({
  tenantUpsert: vi.fn(),
  environmentUpsert: vi.fn(),
  actorUpsert: vi.fn(),
  uploadFileMock: vi.fn()
}));

vi.mock('../../../../systems/_clients/cargo/src', () => ({
  createCargoClient: vi.fn(() => ({
    tenant: {
      upsert: tenantUpsert
    },
    environment: {
      upsert: environmentUpsert
    },
    actor: {
      upsert: actorUpsert
    }
  })),
  uploadFile: uploadFileMock
}));

vi.mock('@metorial/db', () => ({
  ensureFilePurpose: vi.fn(factory => Promise.resolve(factory())),
  db: {
    organization: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    instance: {
      findUnique: vi.fn()
    },
    file: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  getTenantForSubspace: vi.fn()
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      CARGO_API_URL: 'https://cargo.example/metorial-cargo'
    }
  }
}));

import { db } from '@metorial/db';
import { uploadCargoFile } from '../src/cargo';

describe('uploadCargoFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      oid: 11n,
      name: 'Org One'
    } as any);
    tenantUpsert.mockResolvedValue({
      id: 'ten_1',
      identifier: 'mte-org-11',
      name: 'Org One'
    });
    environmentUpsert.mockResolvedValue({
      id: 'env_1',
      identifier: 'default',
      name: 'Default',
      type: 'production'
    });
    actorUpsert.mockResolvedValue({
      id: 'act_1'
    });
    uploadFileMock.mockResolvedValue({
      id: 'fil_1'
    });
  });

  it('forwards actor permissions and store attachment to cargo uploads', async () => {
    await uploadCargoFile({
      owner: {
        type: 'organization',
        organization: {
          id: 'org_1'
        }
      },
      purpose: 'organization_image',
      file: new Blob(['hello'], { type: 'text/plain' }),
      fileName: 'hello.txt',
      accessActor: {
        identifier: 'organization_actor:ora_1',
        name: 'Editor',
        organizationActorId: 'ora_1'
      },
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true,
      store: {
        id: 'sto_1',
        path: '/hello.txt'
      }
    });

    expect(actorUpsert).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      identifier: 'organization_actor:ora_1',
      name: 'Editor',
      organizationActorId: 'ora_1',
      consumerId: undefined
    });
    expect(uploadFileMock).toHaveBeenCalledWith(
      {
        uploadEndpoint: expect.any(String),
        contentEndpoint: expect.any(String)
      },
      {
        tenantId: 'ten_1',
        environmentId: 'env_1',
        purpose: 'organization_image',
        file: expect.any(Blob),
        fileName: 'hello.txt',
        actorId: 'act_1',
        defaultPermissions: ['content_read', 'content_write'],
        overridePermissions: true,
        storeId: undefined,
        store: {
          id: 'sto_1',
          path: '/hello.txt'
        },
        title: undefined,
        fileId: undefined
      }
    );
  });
});
