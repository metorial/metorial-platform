import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  instanceFindUnique: vi.fn(),
  instanceFindFirst: vi.fn(),
  projectFindUnique: vi.fn(),
  projectFindFirst: vi.fn(),
  projectFindMany: vi.fn(),
  organizationFindUnique: vi.fn(),
  environmentFindMany: vi.fn(),
  environmentFindUnique: vi.fn(),
  tenantFindUnique: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    environment: {
      findMany: mocks.environmentFindMany,
      findUnique: mocks.environmentFindUnique
    },
    tenant: { findUnique: mocks.tenantFindUnique }
  }
}));

vi.mock('./metorialDb', () => ({
  metorialDb: {
    instance: {
      findUnique: mocks.instanceFindUnique,
      findFirst: mocks.instanceFindFirst
    },
    project: {
      findUnique: mocks.projectFindUnique,
      findFirst: mocks.projectFindFirst,
      findMany: mocks.projectFindMany
    },
    organization: { findUnique: mocks.organizationFindUnique }
  }
}));

import {
  getProjectScopeDrift,
  isCanonicalEnvironmentIdentifier,
  isCanonicalProjectIdentifier,
  parseCanonicalInstanceOid,
  parseCanonicalProjectOid,
  parseLegacyEnvironmentInstanceId,
  parseLegacyTenantInstanceId,
  parseLegacyTenantOrganizationId,
  resolveInstanceForEnvironment,
  resolveProjectForTenant
} from './legacyScope';

let instance = { oid: 3n, projectOid: 2n };

let makeEnvironment = (overrides: Record<string, unknown> = {}) => ({
  id: 'ken_1',
  identifier: 'mtei-ins_legacy',
  resourceGroupIdentifier: null,
  instanceOid: null,
  ...overrides
});

let makeTenant = (overrides: Record<string, unknown> = {}) => ({
  id: 'ktn_1',
  identifier: 'mte-ins_legacy',
  resourceTenantIdentifier: null,
  projectOid: null,
  ...overrides
});

describe('identifier parsing', () => {
  it('separates canonical identifiers from the legacy ones they resemble', () => {
    expect(isCanonicalProjectIdentifier('mte-pro-2')).toBe(true);
    expect(isCanonicalProjectIdentifier('mteo-org_1')).toBe(false);
    expect(isCanonicalProjectIdentifier(null)).toBe(false);

    expect(isCanonicalEnvironmentIdentifier('mte-ins-3')).toBe(true);
    // The legacy per-instance tenant uses an underscore where the canonical one uses a dash.
    expect(isCanonicalEnvironmentIdentifier('mte-ins_0mlz')).toBe(false);
    expect(isCanonicalEnvironmentIdentifier('mtei-ins_0mlz')).toBe(false);
  });

  it('reads oids out of canonical identifiers only', () => {
    expect(parseCanonicalProjectOid('mte-pro-48526066642506752')).toBe(48526066642506752n);
    expect(parseCanonicalInstanceOid('mte-ins-48526066661381120')).toBe(48526066661381120n);
    expect(parseCanonicalInstanceOid('mte-ins_0mlzkn8h5vDpg9CRUBSlP0')).toBeNull();
    expect(parseCanonicalProjectOid('mte-org-1')).toBeNull();
  });

  it('reads Metorial ids out of legacy identifiers', () => {
    expect(parseLegacyTenantInstanceId('mte-ins_0mlzkn8h5vDpg9CRUBSlP0')).toBe(
      'ins_0mlzkn8h5vDpg9CRUBSlP0'
    );
    expect(parseLegacyTenantOrganizationId('mteo-org_0mm27g7m5kd8d860A3Gv2d')).toBe(
      'org_0mm27g7m5kd8d860A3Gv2d'
    );
    expect(parseLegacyEnvironmentInstanceId('mtei-ins_0mlzkn8h5vDpg9CRUBSlP0')).toBe(
      'ins_0mlzkn8h5vDpg9CRUBSlP0'
    );

    expect(parseLegacyTenantInstanceId('mte-pro-2')).toBeNull();
    expect(parseLegacyTenantOrganizationId('mte-ins_1')).toBeNull();
  });
});

describe('resolveInstanceForEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instanceFindUnique.mockResolvedValue(null);
    mocks.instanceFindFirst.mockResolvedValue(null);
  });

  it('trusts the mirror reference first', async () => {
    mocks.instanceFindUnique.mockResolvedValue(instance);

    let resolution = await resolveInstanceForEnvironment(makeEnvironment({ instanceOid: 3n }));

    expect(resolution).toEqual({
      status: 'resolved',
      value: instance,
      source: 'mirrorInstanceOid'
    });
    expect(mocks.instanceFindFirst).not.toHaveBeenCalled();
  });

  it('falls back to the Metorial pointer', async () => {
    mocks.instanceFindFirst.mockResolvedValue(instance);

    let resolution = await resolveInstanceForEnvironment(makeEnvironment());

    expect(resolution).toMatchObject({ status: 'resolved', source: 'subspaceEnvironmentId' });
    expect(mocks.instanceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subspaceEnvironmentId: 'ken_1' } })
    );
  });

  it('reads the instance id out of the legacy identifier', async () => {
    mocks.instanceFindUnique.mockResolvedValue(instance);

    let resolution = await resolveInstanceForEnvironment(
      makeEnvironment({ identifier: 'mtei-ins_legacy' })
    );

    expect(resolution).toMatchObject({ status: 'resolved', source: 'legacyIdentifier' });
    expect(mocks.instanceFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ins_legacy' } })
    );
  });

  it('falls back to the resource group identifier', async () => {
    mocks.instanceFindUnique.mockImplementation(async ({ where }: any) =>
      where.oid === 3n ? instance : null
    );

    let resolution = await resolveInstanceForEnvironment(
      makeEnvironment({ identifier: 'legacy-nonsense', resourceGroupIdentifier: 'mte-ins-3' })
    );

    expect(resolution).toMatchObject({ status: 'resolved', source: 'canonicalIdentifier' });
  });

  it('reports an environment it cannot place', async () => {
    let resolution = await resolveInstanceForEnvironment(
      makeEnvironment({ identifier: 'legacy-nonsense' })
    );

    expect(resolution).toEqual({
      status: 'unresolved',
      reason: expect.stringContaining('No Metorial instance resolves')
    });
  });
});

describe('resolveProjectForTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instanceFindUnique.mockResolvedValue(null);
    mocks.projectFindUnique.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue(null);
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.organizationFindUnique.mockResolvedValue(null);
    mocks.environmentFindMany.mockResolvedValue([]);
  });

  it('trusts the mirror reference first', async () => {
    mocks.projectFindUnique.mockResolvedValue({ oid: 2n });

    let resolution = await resolveProjectForTenant(makeTenant({ projectOid: 2n }));

    expect(resolution).toEqual({ status: 'resolved', value: 2n, source: 'mirrorProjectOid' });
  });

  it('uses the resource tenant identifier the partial migration left behind', async () => {
    mocks.projectFindUnique.mockResolvedValue({ oid: 48526066642506752n });

    let resolution = await resolveProjectForTenant(
      makeTenant({ resourceTenantIdentifier: 'mte-pro-48526066642506752' })
    );

    expect(resolution).toEqual({
      status: 'resolved',
      value: 48526066642506752n,
      source: 'canonicalIdentifier'
    });
  });

  it('resolves a per-instance legacy tenant through its instance', async () => {
    mocks.instanceFindUnique.mockResolvedValue(instance);

    let resolution = await resolveProjectForTenant(
      makeTenant({ identifier: 'mte-ins_legacy' })
    );

    expect(resolution).toEqual({
      status: 'resolved',
      value: 2n,
      source: 'legacyInstanceIdentifier'
    });
  });

  it('resolves a per-organization legacy tenant when the org has a single project', async () => {
    mocks.organizationFindUnique.mockResolvedValue({ oid: 1n });
    mocks.projectFindMany.mockResolvedValue([{ oid: 2n }]);

    let resolution = await resolveProjectForTenant(
      makeTenant({ identifier: 'mteo-org_legacy' })
    );

    expect(resolution).toEqual({
      status: 'resolved',
      value: 2n,
      source: 'legacyOrganizationIdentifier'
    });
  });

  it('refuses to guess when the organization owns several projects', async () => {
    mocks.organizationFindUnique.mockResolvedValue({ oid: 1n });
    mocks.projectFindMany.mockResolvedValue([{ oid: 2n }, { oid: 5n }]);

    let resolution = await resolveProjectForTenant(
      makeTenant({ identifier: 'mteo-org_legacy' })
    );

    expect(resolution).toEqual({
      status: 'unresolved',
      reason: expect.stringContaining('more than one active project')
    });
  });

  it('falls back to the projects behind its environments', async () => {
    mocks.environmentFindMany.mockResolvedValue([
      {
        id: 'ken_1',
        identifier: 'mtei-ins_legacy',
        resourceGroupIdentifier: null,
        instanceOid: 3n
      }
    ]);
    mocks.instanceFindUnique.mockResolvedValue(instance);

    let resolution = await resolveProjectForTenant(makeTenant({ identifier: 'nonsense' }));

    expect(resolution).toEqual({ status: 'resolved', value: 2n, source: 'environments' });
  });

  it('reports a tenant it cannot place', async () => {
    let resolution = await resolveProjectForTenant(makeTenant({ identifier: 'nonsense' }));

    expect(resolution).toEqual({
      status: 'unresolved',
      reason: expect.stringContaining('No Metorial project resolves')
    });
  });
});

describe('getProjectScopeDrift', () => {
  let makeScopedProject = (overrides: Record<string, unknown> = {}) => ({
    oid: 2n,
    id: 'pro_1',
    subspaceTenantId: 'ktn_1',
    internalTenantIdentifier: 'mte-pro-2',
    instances: [
      {
        oid: 3n,
        id: 'ins_1',
        subspaceTenantId: 'ktn_1',
        internalTenantIdentifier: 'mte-pro-2',
        subspaceEnvironmentId: 'ken_1',
        internalEnvironmentIdentifier: 'mte-ins-3'
      }
    ],
    ...overrides
  });

  beforeEach(() => {
    mocks.projectFindUnique.mockResolvedValue(makeScopedProject());
    mocks.tenantFindUnique.mockResolvedValue({
      oid: 20n,
      identifier: 'mte-pro-2',
      retiredAt: null
    });
    mocks.environmentFindUnique.mockResolvedValue({
      identifier: 'mte-ins-3',
      tenantOid: 20n
    });
  });

  it('sees no drift when both sides are canonical', async () => {
    expect(await getProjectScopeDrift({ projectOid: 2n })).toEqual({
      hasDrift: false,
      reasons: [],
      notes: []
    });
  });

  it('flags a project still pointing at a legacy tenant', async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      oid: 20n,
      identifier: 'mteo-org_legacy',
      retiredAt: null
    });

    let drift = await getProjectScopeDrift({ projectOid: 2n });

    expect(drift.hasDrift).toBe(true);
    expect(drift.reasons).toContainEqual(expect.stringContaining('expected mte-pro-2'));
  });

  it('flags pointers to tenants that are gone or retired', async () => {
    mocks.tenantFindUnique.mockResolvedValue(null);
    expect((await getProjectScopeDrift({ projectOid: 2n })).reasons).toContainEqual(
      expect.stringContaining('missing tenant')
    );

    mocks.tenantFindUnique.mockResolvedValue({
      oid: 20n,
      identifier: 'mte-pro-2',
      retiredAt: new Date()
    });
    expect((await getProjectScopeDrift({ projectOid: 2n })).reasons).toContainEqual(
      expect.stringContaining('retired tenant')
    );
  });

  it('flags an instance whose environment kept its legacy identifier', async () => {
    mocks.environmentFindUnique.mockResolvedValue({
      identifier: 'mtei-ins_legacy',
      tenantOid: 20n
    });

    let drift = await getProjectScopeDrift({ projectOid: 2n });

    expect(drift.hasDrift).toBe(true);
    expect(drift.reasons).toContainEqual(expect.stringContaining('expected mte-ins-3'));
  });

  it('flags an environment parked under a different tenant', async () => {
    mocks.environmentFindUnique.mockResolvedValue({
      identifier: 'mte-ins-3',
      tenantOid: 99n
    });

    expect((await getProjectScopeDrift({ projectOid: 2n })).reasons).toContainEqual(
      expect.stringContaining('different tenant')
    );
  });

  it('flags stale internal identifiers even when the rows are canonical', async () => {
    mocks.projectFindUnique.mockResolvedValue(
      makeScopedProject({ internalTenantIdentifier: 'mteo-org_legacy' })
    );

    expect((await getProjectScopeDrift({ projectOid: 2n })).reasons).toContainEqual(
      expect.stringContaining('is labelled mteo-org_legacy')
    );
  });

  it('treats an unprovisioned project as clean', async () => {
    mocks.projectFindUnique.mockResolvedValue(
      makeScopedProject({
        subspaceTenantId: null,
        internalTenantIdentifier: null,
        instances: []
      })
    );

    expect(await getProjectScopeDrift({ projectOid: 2n })).toEqual({
      hasDrift: false,
      reasons: [],
      notes: []
    });
  });

  it('does not defer a project whose tenant names a different project', async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      oid: 20n,
      identifier: 'mte-pro-777',
      retiredAt: null
    });

    let drift = await getProjectScopeDrift({ projectOid: 2n });

    // Reporting drift here would exclude the project from every other reconciler forever.
    expect(drift.hasDrift).toBe(false);
    expect(drift.notes).toContainEqual(expect.stringContaining('names another project'));
  });

  it("does not defer an instance pointing at another instance's environment", async () => {
    mocks.environmentFindUnique.mockResolvedValue({
      identifier: 'mte-ins-999',
      tenantOid: 20n
    });

    let drift = await getProjectScopeDrift({ projectOid: 2n });

    expect(drift.hasDrift).toBe(false);
    expect(drift.notes).toContainEqual(expect.stringContaining('names another instance'));
  });

  it('flags a label that is missing entirely', async () => {
    mocks.projectFindUnique.mockResolvedValue(
      makeScopedProject({ internalTenantIdentifier: null })
    );

    expect((await getProjectScopeDrift({ projectOid: 2n })).hasDrift).toBe(true);
  });
});
