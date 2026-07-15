import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  organizationActorFindUnique: vi.fn(),
  organizationActorFindFirst: vi.fn(),
  consumerFindUnique: vi.fn(),
  consumerFindFirst: vi.fn(),
  ownershipFindUnique: vi.fn(),
  ownershipUpsert: vi.fn(),
  generateId: vi.fn(async () => 'csmor_test')
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationActor: {
      findUnique: mocks.organizationActorFindUnique,
      findFirst: mocks.organizationActorFindFirst
    },
    consumer: {
      findUnique: mocks.consumerFindUnique,
      findFirst: mocks.consumerFindFirst
    },
    cargoSyncMetorialOwnedRecord: {
      findUnique: mocks.ownershipFindUnique,
      upsert: mocks.ownershipUpsert
    }
  },
  ID: {
    generateId: mocks.generateId
  }
}));

import {
  claimCargoSyncRecordOwnership,
  isCargoSyncRecordOwned
} from './ownership';
import { resolveResourceActorLinks } from './actor';
import { cargoSyncModels } from './models';
import { setCargoSyncClaimMetorialOwnership } from './flags';

describe('Cargo synchronization metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCargoSyncClaimMetorialOwnership(false);
    mocks.organizationActorFindUnique.mockResolvedValue(null);
    mocks.organizationActorFindFirst.mockResolvedValue(null);
    mocks.consumerFindUnique.mockResolvedValue(null);
    mocks.consumerFindFirst.mockResolvedValue(null);
    mocks.ownershipFindUnique.mockResolvedValue(null);
  });

  it('covers every Cargo model exactly once', () => {
    expect(cargoSyncModels).toHaveLength(48);
    expect(new Set(cargoSyncModels.map(model => model.source)).size).toBe(48);
  });

  it('keeps ownership writes disabled while still checking the table', async () => {
    expect(await isCargoSyncRecordOwned('File', 'fil_test')).toBe(false);
    expect(mocks.ownershipFindUnique).toHaveBeenCalledOnce();

    await claimCargoSyncRecordOwnership('File', 'fil_test');
    expect(mocks.ownershipUpsert).not.toHaveBeenCalled();

    setCargoSyncClaimMetorialOwnership(true);
    await claimCargoSyncRecordOwnership('File', 'fil_test');
    expect(mocks.ownershipUpsert).toHaveBeenCalledOnce();
  });
});

describe('Resource actor reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.organizationActorFindUnique.mockResolvedValue(null);
    mocks.organizationActorFindFirst.mockResolvedValue(null);
    mocks.consumerFindUnique.mockResolvedValue(null);
    mocks.consumerFindFirst.mockResolvedValue(null);
  });

  it('links an organization actor by public id', async () => {
    mocks.organizationActorFindUnique.mockResolvedValue({ oid: 11n });

    await expect(
      resolveResourceActorLinks({
        id: 'crg_ta_1',
        organizationActorId: 'oac_1',
        consumerId: null
      })
    ).resolves.toEqual({
      organizationActorOid: 11n,
      consumerOid: null,
      conflict: false
    });
  });

  it('uses the reverse Cargo actor link as a fallback', async () => {
    mocks.consumerFindFirst.mockResolvedValue({ oid: 22n });

    await expect(
      resolveResourceActorLinks({
        id: 'crg_ta_2',
        organizationActorId: null,
        consumerId: null
      })
    ).resolves.toEqual({
      organizationActorOid: null,
      consumerOid: 22n,
      conflict: false
    });
  });

  it('leaves unresolved and ambiguous actor links empty', async () => {
    await expect(
      resolveResourceActorLinks({
        id: 'crg_ta_3',
        organizationActorId: 'missing',
        consumerId: null
      })
    ).resolves.toEqual({
      organizationActorOid: null,
      consumerOid: null,
      conflict: false
    });

    mocks.organizationActorFindUnique.mockResolvedValue({ oid: 11n });
    mocks.consumerFindUnique.mockResolvedValue({ oid: 22n });
    await expect(
      resolveResourceActorLinks({
        id: 'crg_ta_4',
        organizationActorId: 'oac_1',
        consumerId: 'cng_1'
      })
    ).resolves.toEqual({
      organizationActorOid: null,
      consumerOid: null,
      conflict: true
    });
  });
});
