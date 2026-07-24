import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  resolveResourceScopeForOwner: vi.fn(),
  getSkillById: vi.fn(),
  assertConsumerCanWriteSkill: vi.fn()
}));

vi.mock('@metorial/module-resource-tenant', () => ({
  resolveResourceScopeForOwner: mocks.resolveResourceScopeForOwner
}));

vi.mock('@metorial/cargo-module-skill', () => ({
  skillService: {
    getSkillById: mocks.getSkillById
  }
}));

vi.mock('@metorial/module-consumer', () => ({
  consumerSkillService: {
    assertConsumerCanWriteSkill: mocks.assertConsumerCanWriteSkill
  }
}));

import { assertConsumerCanWriteSkillGroupItem } from './skillGroupItemAccess';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertConsumerCanWriteSkillGroupItem', () => {
  it('lazily resolves the instance scope before checking consumer access', async () => {
    let resourceTenant = { oid: 1n, id: 'rtn_1' };
    let resourceGroup = { oid: 2n, id: 'rgr_1' };
    let skill = { oid: 3n, id: 'skl_1' };
    let consumerProfile = { oid: 4n, id: 'cpr_1' };

    mocks.resolveResourceScopeForOwner.mockResolvedValue({
      resourceTenant,
      resourceGroup
    });
    mocks.getSkillById.mockResolvedValue(skill);

    await assertConsumerCanWriteSkillGroupItem({
      instance: { id: 'ins_1' } as any,
      skillId: 'skl_1',
      consumerProfile: consumerProfile as any
    });

    expect(mocks.resolveResourceScopeForOwner).toHaveBeenCalledWith({
      type: 'instance',
      instance: { id: 'ins_1' }
    });
    expect(mocks.getSkillById).toHaveBeenCalledWith({
      resourceTenant,
      resourceGroup,
      skillId: 'skl_1',
      allowDeleted: true,
      consumerProfileOid: 4n
    });
    expect(mocks.assertConsumerCanWriteSkill).toHaveBeenCalledWith({
      skill,
      consumerProfile
    });
  });

  it('does not provision a scope for non-consumer requests', async () => {
    await assertConsumerCanWriteSkillGroupItem({
      instance: { id: 'ins_1' } as any,
      skillId: 'skl_1'
    });

    expect(mocks.resolveResourceScopeForOwner).not.toHaveBeenCalled();
  });
});
