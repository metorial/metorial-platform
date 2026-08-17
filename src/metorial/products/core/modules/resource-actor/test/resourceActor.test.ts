import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    consumerProfile: {
      findFirst: vi.fn()
    },
    resourceActor: {
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn()
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

let project = { oid: 5n };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resource actor identity', () => {
  it('upserts and looks up actors within their project', async () => {
    db.resourceActor.upsert.mockResolvedValue({ oid: 3n, id: 'rac_1' });
    db.resourceActor.findFirst.mockResolvedValue({ oid: 3n, id: 'rac_1' });

    await resourceActorService.upsertActor({
      project,
      input: {
        identifier: 'actor-one',
        name: 'Actor One'
      }
    });
    await resourceActorService.getActorById({ project, actorId: 'rac_1' });

    expect(db.resourceActor.upsert).toHaveBeenCalledWith({
      where: {
        projectOid_identifier: {
          projectOid: 5n,
          identifier: 'actor-one'
        }
      },
      update: {
        type: undefined,
        name: 'Actor One',
        organizationActorOid: undefined,
        consumerOid: undefined,
        consumerProfileOid: undefined
      },
      create: {
        id: 'rac_generated',
        projectOid: 5n,
        identifier: 'actor-one',
        type: 'external',
        name: 'Actor One',
        organizationActorOid: undefined,
        consumerOid: undefined,
        consumerProfileOid: undefined
      }
    });
    expect(db.resourceActor.findFirst).toHaveBeenLastCalledWith({
      where: {
        projectOid: 5n,
        OR: [{ id: 'rac_1' }, { identifier: 'rac_1' }]
      }
    });
  });

  it('returns the existing actor after a concurrent unique conflict', async () => {
    let resourceActor = { oid: 3n, id: 'rac_1', identifier: 'actor-one' };
    db.resourceActor.upsert.mockRejectedValue({ code: 'P2002' });
    db.resourceActor.findFirst.mockResolvedValue(resourceActor);

    await expect(
      resourceActorService.upsertActor({
        project,
        input: {
          identifier: 'actor-one',
          name: 'Actor One'
        }
      })
    ).resolves.toBe(resourceActor);

    expect(db.resourceActor.findFirst).toHaveBeenCalledWith({
      where: {
        projectOid: 5n,
        identifier: 'actor-one'
      }
    });
  });

  it('updates the matching actor when an explicit ID is given', async () => {
    db.resourceActor.findFirst.mockResolvedValue({
      oid: 3n,
      id: 'rac_1',
      type: 'system'
    });
    db.resourceActor.update.mockResolvedValue({ oid: 3n, id: 'rac_1' });

    await resourceActorService.upsertActor({
      project,
      input: {
        id: 'rac_1',
        identifier: 'actor-one',
        name: 'Actor One'
      }
    });

    expect(db.resourceActor.findFirst).toHaveBeenCalledWith({
      where: {
        projectOid: 5n,
        OR: [{ id: 'rac_1' }, { identifier: 'actor-one' }]
      }
    });
    expect(db.resourceActor.update).toHaveBeenCalledWith({
      where: {
        id: 'rac_1'
      },
      data: {
        identifier: 'actor-one',
        type: 'system',
        name: 'Actor One',
        organizationActorOid: undefined,
        consumerOid: undefined,
        consumerProfileOid: undefined
      }
    });
  });

  it('rejects consumer-only resource actors', async () => {
    await expect(
      resourceActorService.upsertActor({
        project,
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
      project,
      consumerProfileOid: 3n
    });

    expect(db.consumerProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          oid: 3n,
          instance: { projectOid: 5n }
        }
      })
    );
    expect(db.resourceActor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          projectOid: 5n,
          consumerOid: 2n,
          consumerProfileOid: 3n
        })
      })
    );
  });
});
