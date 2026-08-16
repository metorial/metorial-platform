import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    user: {
      findUnique: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    },
    instance: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({ db }));

import { resolveInstanceScope, resolveOwnerScope } from './ownerScope';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('owner scope resolution', () => {
  it('resolves an instance to its own and its project oid', async () => {
    db.instance.findUnique.mockResolvedValue({ oid: 3n, projectOid: 4n });

    await expect(resolveInstanceScope({ id: 'ins_1' })).resolves.toEqual({
      project: { oid: 4n },
      instance: { oid: 3n }
    });

    expect(db.instance.findUnique).toHaveBeenCalledWith({
      where: { id: 'ins_1' },
      select: { oid: true, projectOid: true }
    });
  });

  it('rejects an unknown instance', async () => {
    db.instance.findUnique.mockResolvedValue(null);

    await expect(resolveInstanceScope({ id: 'ins_missing' })).rejects.toThrow('ins_missing');
  });

  it('resolves an instance owner through the instance scope', async () => {
    db.instance.findUnique.mockResolvedValue({ oid: 3n, projectOid: 4n });

    await expect(
      resolveOwnerScope({ type: 'instance', instance: { id: 'ins_1' } })
    ).resolves.toEqual({
      project: { oid: 4n },
      instance: { oid: 3n }
    });
  });

  it('resolves a user owner', async () => {
    db.user.findUnique.mockResolvedValue({ oid: 7n });

    await expect(resolveOwnerScope({ type: 'user', user: { id: 'usr_1' } })).resolves.toEqual({
      user: { oid: 7n }
    });

    expect(db.instance.findUnique).not.toHaveBeenCalled();
  });

  it('resolves an organization owner', async () => {
    db.organization.findUnique.mockResolvedValue({ oid: 9n });

    await expect(
      resolveOwnerScope({ type: 'organization', organization: { id: 'org_1' } })
    ).resolves.toEqual({ organization: { oid: 9n } });
  });

  it('rejects an unknown organization', async () => {
    db.organization.findUnique.mockResolvedValue(null);

    await expect(
      resolveOwnerScope({ type: 'organization', organization: { id: 'org_missing' } })
    ).rejects.toThrow('org_missing');
  });
});
