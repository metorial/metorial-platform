import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let projectOrganizations = new Map([
    [2n, 1n],
    [7n, 6n]
  ]);
  let instanceOrganizations = new Map([
    [3n, 1n],
    [4n, 1n],
    [8n, 6n]
  ]);
  let parents = {
    organization: (oid: bigint) => oid,
    project: (oid: bigint) => projectOrganizations.get(oid),
    instance: (oid: bigint) => instanceOrganizations.get(oid)
  };

  // Upserts look up and then create, so two writers can race.
  let model = (level: keyof typeof parents, parentKey: string) => {
    let rows = new Map<bigint, Record<string, any>>();

    let matches = (oid: bigint, where: any) =>
      where[parentKey] !== undefined
        ? where[parentKey] == oid
        : parents[level](oid) == (where.project ?? where.instance).organizationOid;

    return {
      rows,
      findUnique: async ({ where }: any) => rows.get(where[parentKey]) ?? null,
      upsert: async ({ where, create, update }: any) => {
        let key = where[parentKey];
        let existing = rows.has(key);
        await new Promise(resolve => setTimeout(resolve, 0));

        if (existing) rows.set(key, { ...rows.get(key), ...update });
        else if (rows.has(key)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        } else rows.set(key, create);
      },
      deleteMany: async ({ where }: any) => {
        for (let oid of [...rows.keys()]) if (matches(oid, where)) rows.delete(oid);
      }
    };
  };

  let models = {
    agentTrackingOrganizationLink: model('organization', 'organizationOid'),
    agentTrackingProjectLink: model('project', 'projectOid'),
    agentTrackingInstanceLink: model('instance', 'instanceOid')
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
  ID: { generateId: async (type: string) => `${type}_1` },
  isUniqueConstraintError: (error: any) => error?.code === 'P2002',
  withTransaction: async (callback: (db: unknown) => unknown) => await callback(mocks.db)
}));

vi.mock('../src/lib/client', () => ({ requireAgentTracking: () => mocks.agentTracking }));

import {
  linkInstance,
  linkOrganization,
  linkProject,
  readInstanceLink,
  readOrganizationLink,
  unlinkInstance,
  unlinkOrganizationTree,
  unlinkProject
} from '../src/lib/links';
import { withInstanceScope } from '../src/lib/scope';

let { models } = mocks;

let stored = () => ({
  organizations: [...models.agentTrackingOrganizationLink.rows.keys()],
  projects: [...models.agentTrackingProjectLink.rows.keys()],
  instances: [...models.agentTrackingInstanceLink.rows.keys()]
});

let linkTree = async () => {
  await linkOrganization({ oid: 1n }, 'ator_1');
  await linkProject({ oid: 2n }, 'atpr_1');
  await linkInstance({ oid: 3n }, 'atin_1');
  await linkInstance({ oid: 4n }, 'atin_2');
  await linkOrganization({ oid: 6n }, 'ator_other');
  await linkProject({ oid: 7n }, 'atpr_other');
  await linkInstance({ oid: 8n }, 'atin_other');
};

describe('agent-tracking scope links', () => {
  beforeEach(() => {
    for (let m of Object.values(models)) m.rows.clear();
  });

  it('reads back a stored link and nothing for an unlinked scope', async () => {
    await linkInstance({ oid: 3n }, 'atin_1');

    expect(await readInstanceLink({ oid: 3n })).toBe('atin_1');
    expect(await readInstanceLink({ oid: 9n })).toBeUndefined();
  });

  it('drops the link of one project or instance and keeps the others', async () => {
    await linkTree();

    await unlinkProject({ oid: 2n });
    await unlinkInstance({ oid: 4n });

    expect(stored()).toEqual({ organizations: [1n, 6n], projects: [7n], instances: [3n, 8n] });
  });

  it('drops every link of one organization and keeps the others', async () => {
    await linkTree();

    await unlinkOrganizationTree({ oid: 1n });

    expect(stored()).toEqual({ organizations: [6n], projects: [7n], instances: [8n] });
  });

  it('drops the links below an organization the service re-created under a new id', async () => {
    await linkTree();

    await linkOrganization({ oid: 1n }, 'ator_1');
    expect(stored().instances).toEqual([3n, 4n, 8n]);

    await linkOrganization({ oid: 1n }, 'ator_recreated');

    expect(await readOrganizationLink({ oid: 1n })).toBe('ator_recreated');
    expect(stored()).toEqual({ organizations: [6n, 1n], projects: [7n], instances: [8n] });
  });

  it('settles two concurrent first uses of a scope on one stored link', async () => {
    let upsert = (id: string) => vi.fn(async () => ({ id }));
    let agentTracking = (mocks.agentTracking = {
      organization: { upsert: upsert('ator_1') },
      project: { upsert: upsert('atpr_1') },
      instance: { upsert: upsert('atin_1') }
    });
    let scope = {
      organization: { oid: 1n, id: 'org_1', name: 'Acme' },
      project: { oid: 2n, id: 'proj_1', name: 'Production' },
      instance: { oid: 3n, id: 'inst_1', name: 'Default' }
    };
    let serviceId = async (serviceInstanceId: string) => serviceInstanceId;

    let results = await Promise.all([
      withInstanceScope(scope, serviceId),
      withInstanceScope(scope, serviceId)
    ]);

    expect(results).toEqual(['atin_1', 'atin_1']);
    expect(models.agentTrackingInstanceLink.rows.get(3n)).toMatchObject({
      serviceInstanceId: 'atin_1'
    });

    expect(await withInstanceScope(scope, serviceId)).toBe('atin_1');
    expect(agentTracking.instance.upsert).toHaveBeenCalledTimes(2);
  });

  it('passes on a write error that is not a concurrent first use', async () => {
    let failure = new Error('connection lost');
    let upsert = models.agentTrackingInstanceLink.upsert;
    models.agentTrackingInstanceLink.upsert = async () => {
      throw failure;
    };

    try {
      await expect(linkInstance({ oid: 3n }, 'atin_1')).rejects.toBe(failure);
    } finally {
      models.agentTrackingInstanceLink.upsert = upsert;
    }
  });
});
