import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    consumerProfile: {
      findFirst: vi.fn()
    },
    resourceActor: {
      upsert: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn(async () => 'rac_generated')
  }
}));

import { resourceActorService } from '../src/services/resourceActor';

let resourceTenant = {
  oid: 1n,
  id: 'rtn_1'
};

describe('resource actor consumer identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects consumer-only resource actors', async () => {
    await expect(
      resourceActorService.upsertActor({
        resourceTenant: resourceTenant as any,
        input: {
          identifier: 'mte-con-consumer_1',
          name: 'Consumer',
          consumerOid: 2n
        }
      })
    ).rejects.toThrow('linked to a consumer profile');

    expect(db.resourceActor.upsert).not.toHaveBeenCalled();
  });

  it('upserts profile-linked consumer resource actors', async () => {
    db.consumerProfile.findFirst.mockResolvedValue({
      oid: 3n,
      id: 'cpf_1',
      name: 'Consumer profile',
      consumerOid: 2n
    });
    db.resourceActor.upsert.mockResolvedValue({
      oid: 4n,
      id: 'rac_1',
      consumerOid: 2n,
      consumerProfileOid: 3n
    });

    await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: resourceTenant as any,
      consumerProfileOid: 3n
    });

    expect(db.resourceActor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          consumerOid: 2n,
          consumerProfileOid: 3n
        }),
        update: expect.objectContaining({
          consumerOid: 2n,
          consumerProfileOid: 3n
        })
      })
    );
  });
});
