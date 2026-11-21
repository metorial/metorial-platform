import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let model = (organizationOids: [bigint, bigint][]) => {
    let rows = new Map(
      organizationOids.map(([oid, organizationOid]) => [
        oid,
        { organizationOid, agentTrackingLinkedAt: null as Date | null }
      ])
    );
    let writes = { count: 0 };

    let matches = (oid: bigint, where: any) => {
      let row = rows.get(oid)!;
      if (where.oid !== undefined && where.oid != oid) return false;
      if (where.organizationOid !== undefined && where.organizationOid != row.organizationOid)
        return false;
      if (where.agentTrackingLinkedAt === null) return row.agentTrackingLinkedAt === null;
      if (where.agentTrackingLinkedAt?.not === null) return row.agentTrackingLinkedAt !== null;
      return true;
    };

    return {
      rows,
      writes,
      findUnique: async ({ where }: any) => rows.get(where.oid) ?? null,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (let oid of rows.keys()) {
          if (!matches(oid, where)) continue;
          rows.set(oid, { ...rows.get(oid)!, ...data });
          count++;
        }
        writes.count += count;
        return { count };
      }
    };
  };

  let models = {
    organization: model([
      [1n, 1n],
      [6n, 6n]
    ]),
    project: model([
      [2n, 1n],
      [7n, 6n]
    ]),
    instance: model([
      [3n, 1n],
      [4n, 1n],
      [8n, 6n]
    ])
  };
  let settings = {
    agentTrackingOrganizationSettings: { findFirst: async () => null },
    agentTrackingProjectSettings: { findFirst: async () => null },
    agentTrackingInstanceSettings: { findFirst: async () => null }
  };

  return { models, db: { ...settings, ...models }, agentTracking: {} as any };
});

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  withTransaction: async (callback: (db: unknown) => unknown) => await callback(mocks.db)
}));

vi.mock('../src/lib/client', () => ({ requireAgentTracking: () => mocks.agentTracking }));

import {
  isInstanceLinked,
  markInstanceLinked,
  markOrganizationLinked,
  markProjectLinked,
  unlinkInstance,
  unlinkOrganizationTree,
  unlinkProject
} from '../src/lib/links';
import { withInstanceScope } from '../src/lib/scope';

let { models } = mocks;

let linked = () => {
  let oids = (m: (typeof models)[keyof typeof models]) =>
    [...m.rows].filter(([, row]) => row.agentTrackingLinkedAt).map(([oid]) => oid);

  return {
    organizations: oids(models.organization),
    projects: oids(models.project),
    instances: oids(models.instance)
  };
};

let linkTree = async () => {
  await markOrganizationLinked({ oid: 1n });
  await markProjectLinked({ oid: 2n });
  await markInstanceLinked({ oid: 3n });
  await markInstanceLinked({ oid: 4n });
  await markOrganizationLinked({ oid: 6n });
  await markProjectLinked({ oid: 7n });
  await markInstanceLinked({ oid: 8n });
};

describe('agent-tracking scope links', () => {
  beforeEach(() => {
    for (let m of Object.values(models)) {
      for (let row of m.rows.values()) row.agentTrackingLinkedAt = null;
      m.writes.count = 0;
    }
  });

  it('reads back a linked scope and nothing for an unlinked one', async () => {
    await markInstanceLinked({ oid: 3n });

    expect(await isInstanceLinked({ oid: 3n })).toBe(true);
    expect(await isInstanceLinked({ oid: 4n })).toBe(false);
    expect(await isInstanceLinked({ oid: 9n })).toBe(false);
  });

  it('keeps the first link time and writes nothing when a linked scope is linked again', async () => {
    await markInstanceLinked({ oid: 3n });
    let first = models.instance.rows.get(3n)!.agentTrackingLinkedAt;

    await markInstanceLinked({ oid: 3n });

    expect(models.instance.rows.get(3n)!.agentTrackingLinkedAt).toBe(first);
    expect(models.instance.writes.count).toBe(1);
  });

  it('unlinks one project or instance and keeps the others', async () => {
    await linkTree();

    await unlinkProject({ oid: 2n });
    await unlinkInstance({ oid: 4n });

    expect(linked()).toEqual({ organizations: [1n, 6n], projects: [7n], instances: [3n, 8n] });
  });

  it('unlinks every scope of one organization and keeps the others', async () => {
    await linkTree();

    await unlinkOrganizationTree({ oid: 1n });

    expect(linked()).toEqual({ organizations: [6n], projects: [7n], instances: [8n] });
  });

  it('settles two concurrent first uses of a scope on one link', async () => {
    let upsert = () => vi.fn(async (input: { ref: string }) => ({ id: input.ref }));
    let agentTracking = (mocks.agentTracking = {
      organization: { upsert: upsert() },
      project: { upsert: upsert() },
      instance: { upsert: upsert() }
    });
    let scope = {
      organization: { oid: 1n, id: 'org_1', name: 'Acme' },
      project: { oid: 2n, id: 'proj_1', name: 'Production' },
      instance: { oid: 3n, id: 'inst_1', name: 'Default' }
    };
    let run = async () => 'done';

    let results = await Promise.all([
      withInstanceScope(scope, run),
      withInstanceScope(scope, run)
    ]);

    expect(results).toEqual(['done', 'done']);
    expect(await isInstanceLinked(scope.instance)).toBe(true);

    expect(await withInstanceScope(scope, run)).toBe('done');
    expect(agentTracking.instance.upsert).toHaveBeenCalledTimes(2);
    expect(models.instance.writes.count).toBe(1);
  });
});
