import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  fire: vi.fn()
}));

vi.mock('@mtsrc/agent-tracking-db', () => ({
  snowflake: { nextId: () => 10n },
  db: {
    instance: {
      findUnique: vi.fn(async ({ where }: any) => mocks.rows.get(where.ref) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        let row = mocks.rows.get(where.ref);
        row = row ? { ...row, ...update } : create;
        mocks.rows.set(where.ref, row);
        return { ...row, project: { oid: row.projectOid } };
      })
    }
  }
}));

vi.mock('@mtsrc/agent-tracking-events', () => ({ Events: { fire: mocks.fire } }));

import { db } from '@mtsrc/agent-tracking-db';
import { instanceService } from '../src/services/instance';

let organization = { oid: 1n, id: 'org_1' } as any;
let project = { oid: 2n, id: 'proj_1' } as any;

let raced = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('instanceService.upsertInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows.clear();
  });

  it('creates an instance under the id it is given as ref', async () => {
    let instance = await instanceService.upsertInstance({
      organization,
      project,
      input: { ref: 'inst_1', name: 'Default' }
    });

    expect(instance).toMatchObject({ oid: 10n, id: 'inst_1', ref: 'inst_1' });
  });

  it('settles on the row a concurrent first upsert of the same ref created', async () => {
    vi.mocked(db.instance.upsert).mockImplementationOnce((async () => {
      mocks.rows.set('inst_1', {
        id: 'inst_1',
        ref: 'inst_1',
        organizationOid: 1n,
        projectOid: 2n,
        settings: {}
      });
      throw raced();
    }) as any);

    let instance = await instanceService.upsertInstance({
      organization,
      project,
      input: { ref: 'inst_1', name: 'Default' }
    });

    expect(instance).toMatchObject({ id: 'inst_1', name: 'Default' });
    expect(db.instance.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.fire).toHaveBeenCalledTimes(1);
  });

  it('passes on a second unique violation and any other error', async () => {
    vi.mocked(db.instance.upsert)
      .mockRejectedValueOnce(raced())
      .mockRejectedValueOnce(raced());

    await expect(
      instanceService.upsertInstance({ organization, project, input: { ref: 'inst_1' } })
    ).rejects.toMatchObject({ code: 'P2002' });

    let failure = new Error('connection lost');
    vi.mocked(db.instance.upsert).mockRejectedValueOnce(failure);

    await expect(
      instanceService.upsertInstance({ organization, project, input: { ref: 'inst_2' } })
    ).rejects.toBe(failure);
    expect(mocks.fire).not.toHaveBeenCalled();
  });
});
