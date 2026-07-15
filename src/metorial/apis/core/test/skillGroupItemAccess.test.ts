import { beforeEach, describe, expect, it, vi } from 'vitest';

let { assertConsumerCanWriteSkill, getSkill } = vi.hoisted(() => ({
  assertConsumerCanWriteSkill: vi.fn(),
  getSkill: vi.fn()
}));

vi.mock('@metorial/module-consumer', () => ({
  consumerSkillService: {
    assertConsumerCanWriteSkill
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceSkillService: {
    get: getSkill
  }
}));

import { assertConsumerCanWriteSkillGroupItem } from '../src/controllers/instance/skills/skillGroupItemAccess';

let instance = { oid: 1n };
let consumerProfile = { oid: 2n };
let consumerGroups = [{ oid: 3n }];
let localSkill = { oid: 4n, id: 'skill_1' };

describe('consumer skill group item access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSkill.mockResolvedValue({ localSkill });
  });

  it('allows a consumer to mutate membership for a writable skill', async () => {
    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance: instance as any,
        skillId: localSkill.id,
        consumerProfile: consumerProfile as any,
        consumerGroups
      })
    ).resolves.toBeUndefined();

    expect(getSkill).toHaveBeenCalledWith({
      instance,
      skillId: localSkill.id,
      allowDeleted: true,
      consumerProfile,
      consumerGroups
    });
    expect(assertConsumerCanWriteSkill).toHaveBeenCalledWith({
      skill: localSkill,
      consumerProfile
    });
  });

  it('rejects membership mutation when the skill is not writable', async () => {
    assertConsumerCanWriteSkill.mockRejectedValue(
      new Error('Consumer does not have write access to this skill.')
    );

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance: instance as any,
        skillId: localSkill.id,
        consumerProfile: consumerProfile as any,
        consumerGroups
      })
    ).rejects.toThrow('Consumer does not have write access to this skill.');
  });

  it('does not restrict non-consumer membership mutation', async () => {
    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance: instance as any,
        skillId: localSkill.id
      })
    ).resolves.toBeUndefined();

    expect(getSkill).not.toHaveBeenCalled();
    expect(assertConsumerCanWriteSkill).not.toHaveBeenCalled();
  });
});
