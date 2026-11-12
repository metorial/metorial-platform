import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, origin, isFlagEnabledForInstance } = vi.hoisted(() => ({
  db: {
    project: { findUniqueOrThrow: vi.fn() },
    skillDestination: { create: vi.fn(async ({ data }: any) => ({ oid: 1n, ...data })) }
  },
  origin: {
    tenant: { upsert: vi.fn(async () => ({ id: 'tenant_1' })) },
    codeBucket: { create: vi.fn(async () => ({ id: 'bucket_1' })) }
  },
  isFlagEnabledForInstance: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db, ID: { generateId: async () => 'sdst_1' } }));
vi.mock('@metorial-platform-systems/origin-client', () => ({
  createOriginClient: () => origin
}));
vi.mock('@metorial/skills-common', () => ({
  getProjectTenantIdentifier: (project: { oid: bigint }) => `project-${project.oid}`
}));
vi.mock('@metorial/module-flags', () => ({ flagService: { isFlagEnabledForInstance } }));
vi.mock('../../../../packages/scm-utils/src/env', () => ({
  getSkillsScmUtilsEnv: () => ({ origin: { ORIGIN_URL: 'http://origin' } })
}));

import { createSkillDestination } from '../../../../packages/scm-utils/src/origin';
import { getNewSkillDestinationStorageMode } from './storageMode';

describe('new skill destination storage mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [true, 'manifest'],
    [false, 'code_bucket']
  ])('maps skills-manifest-sync=%s to %s', async (enabled, mode) => {
    isFlagEnabledForInstance.mockResolvedValue(enabled);

    expect(await getNewSkillDestinationStorageMode({ instance: { oid: 5n } })).toBe(mode);
    expect(isFlagEnabledForInstance).toHaveBeenCalledWith({
      instance: { oid: 5n },
      flag: 'skills-manifest-sync'
    });
  });
});

describe('createSkillDestination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a manifest destination without touching Origin', async () => {
    let destination = await createSkillDestination({
      project: { oid: 1n, name: 'Project' },
      storageMode: 'manifest'
    });

    expect(origin.codeBucket.create).not.toHaveBeenCalled();
    expect(origin.tenant.upsert).not.toHaveBeenCalled();
    expect(db.skillDestination.create).toHaveBeenCalledWith({
      data: { id: 'sdst_1', storageMode: 'manifest', lastUsedAt: expect.any(Date) }
    });
    expect(destination).toMatchObject({ storageMode: 'manifest' });
    expect(destination).not.toHaveProperty('codeBucketId');
  });

  it.each([undefined, 'code_bucket' as const])(
    'creates a code bucket for storage mode %s',
    async storageMode => {
      await createSkillDestination({
        project: { oid: 1n, name: 'Project' },
        purpose: 'cargo.skill.managed-plugin',
        storageMode
      });

      expect(origin.codeBucket.create).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        purpose: 'cargo.skill.managed-plugin',
        isReadOnly: false
      });
      expect(db.skillDestination.create).toHaveBeenCalledWith({
        data: { id: 'sdst_1', codeBucketId: 'bucket_1', lastUsedAt: expect.any(Date) }
      });
    }
  );
});
