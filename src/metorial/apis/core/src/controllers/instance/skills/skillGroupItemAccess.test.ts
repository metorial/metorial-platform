import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getSkillGroupById: vi.fn(),
  getSkillGroupAccessLevel: vi.fn(),
  getHighestGrantedAccessLevel: vi.fn(),
  getSkillById: vi.fn(),
  assertSkillWriteAccess: vi.fn(),
  assertStoreAccess: vi.fn()
}));

vi.mock('@metorial/module-skill', () => ({
  skillService: {
    getSkillById: mocks.getSkillById,
    assertSkillWriteAccess: mocks.assertSkillWriteAccess
  }
}));

vi.mock('@metorial/module-skill-groups', () => ({
  skillGroupService: {
    getSkillGroupById: mocks.getSkillGroupById,
    getSkillGroupAccessLevel: mocks.getSkillGroupAccessLevel,
    getHighestGrantedAccessLevel: mocks.getHighestGrantedAccessLevel
  }
}));

vi.mock('@metorial/module-store', () => ({
  skillStoreResource: {
    assertAccess: mocks.assertStoreAccess
  }
}));

import { assertConsumerCanWriteSkillGroupItem } from './skillGroupItemAccess';

let project = { oid: 9n } as any;
let instance = { oid: 8n, id: 'ins_1' } as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('assertConsumerCanWriteSkillGroupItem', () => {
  it('uses the authenticated instance scope before checking consumer access', async () => {
    let skill = { oid: 3n, id: 'skl_1' };
    let consumerProfile = { oid: 4n, id: 'cpr_1' };

    mocks.getSkillById.mockResolvedValue(skill);
    mocks.getSkillGroupById.mockResolvedValue({
      id: 'skg_1',
      allowConsumerSkillAssignment: true
    });

    await assertConsumerCanWriteSkillGroupItem({
      instance,
      project,
      skillGroupId: 'skg_1',
      skillId: 'skl_1',
      action: 'add',
      consumerProfile: consumerProfile as any,
      accessTags: [{ accessTagOid: 5n }],
      authorization: { type: 'restricted' } as any
    });

    expect(mocks.getSkillById).toHaveBeenCalledWith({
      project,
      instance,
      skillId: 'skl_1',
      allowDeleted: true,
      accessTags: [{ accessTagOid: 5n }]
    });
    expect(mocks.getSkillGroupById).toHaveBeenCalledWith({
      project,
      instance,
      skillGroupId: 'skg_1',
      accessTags: [{ accessTagOid: 5n }]
    });
    expect(mocks.assertSkillWriteAccess).toHaveBeenCalledWith({
      project,
      instance,
      skill,
      authorization: { type: 'restricted' }
    });
  });

  it('does not provision a scope for non-consumer requests', async () => {
    await assertConsumerCanWriteSkillGroupItem({
      instance,
      project,
      skillGroupId: 'skg_1',
      skillId: 'skl_1',
      action: 'add',
      authorization: { type: 'privileged' }
    });

    expect(mocks.getSkillGroupById).not.toHaveBeenCalled();
  });

  it('rejects consumer assignment when the shared group disables it', async () => {
    mocks.getSkillGroupById.mockResolvedValue({
      id: 'skg_1',
      allowConsumerSkillAssignment: false
    });
    mocks.getSkillById.mockResolvedValue({ oid: 3n, id: 'skl_1' });

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance,
        project,
        skillGroupId: 'skg_1',
        skillId: 'skl_1',
        action: 'add',
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 5n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('Consumers are not allowed to assign skills to this group.');

    expect(mocks.assertSkillWriteAccess).not.toHaveBeenCalled();
  });

  it('rejects a group that is not shared with the consumer', async () => {
    mocks.getSkillGroupById.mockRejectedValue(new Error('not found'));
    mocks.getSkillById.mockResolvedValue({ oid: 3n, id: 'skl_1' });

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance,
        project,
        skillGroupId: 'skg_unshared',
        skillId: 'skl_1',
        action: 'add',
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 5n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('not found');

    expect(mocks.assertSkillWriteAccess).not.toHaveBeenCalled();
  });

  it('rejects a skill the consumer cannot write', async () => {
    let skill = { oid: 3n, id: 'skl_read_only' };
    mocks.getSkillGroupById.mockResolvedValue({
      id: 'skg_1',
      allowConsumerSkillAssignment: true
    });
    mocks.getSkillById.mockResolvedValue(skill);
    mocks.assertSkillWriteAccess.mockRejectedValue(new Error('forbidden'));

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance,
        project,
        skillGroupId: 'skg_1',
        skillId: skill.id,
        action: 'add',
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 5n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('forbidden');
  });

  it('rejects cross-instance tags through the scoped group lookup', async () => {
    mocks.getSkillGroupById.mockRejectedValue(new Error('cross-instance access'));
    mocks.getSkillById.mockResolvedValue({ oid: 3n, id: 'skl_1' });

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance,
        project,
        skillGroupId: 'skg_1',
        skillId: 'skl_1',
        action: 'add',
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 999n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('cross-instance access');
  });

  it('rejects inactive groups through the scoped group lookup', async () => {
    mocks.getSkillGroupById.mockRejectedValue(new Error('inactive group'));
    mocks.getSkillById.mockResolvedValue({ oid: 3n, id: 'skl_1' });

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance,
        project,
        skillGroupId: 'skg_archived',
        skillId: 'skl_1',
        action: 'add',
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 5n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('inactive group');
  });

  it('lets group editors assign skills when consumer assignment is disabled', async () => {
    let skill = { oid: 3n, id: 'skl_1', store: { oid: 6n } };
    mocks.getSkillGroupById.mockResolvedValue({
      oid: 2n,
      id: 'skg_1',
      allowConsumerSkillAssignment: false
    });
    mocks.getSkillById.mockResolvedValue(skill);
    mocks.getSkillGroupAccessLevel.mockResolvedValue('write');
    mocks.getHighestGrantedAccessLevel.mockResolvedValue('write');

    await assertConsumerCanWriteSkillGroupItem({
      instance,
      project,
      skillGroupId: 'skg_1',
      skillId: skill.id,
      action: 'add',
      consumerProfile: { oid: 4n } as any,
      accessTags: [{ accessTagOid: 5n }],
      authorization: { type: 'restricted' } as any
    });

    expect(mocks.assertSkillWriteAccess).toHaveBeenCalled();
    expect(mocks.assertStoreAccess).not.toHaveBeenCalled();
  });

  it('lets group editors remove skills they cannot write', async () => {
    mocks.getSkillGroupById.mockResolvedValue({
      oid: 2n,
      id: 'skg_1',
      allowConsumerSkillAssignment: false
    });
    mocks.getSkillById.mockResolvedValue({ oid: 3n, id: 'skl_1', store: { oid: 6n } });
    mocks.getSkillGroupAccessLevel.mockResolvedValue('write');

    await assertConsumerCanWriteSkillGroupItem({
      instance,
      project,
      skillGroupId: 'skg_1',
      skillId: 'skl_1',
      action: 'remove',
      consumerProfile: { oid: 4n } as any,
      accessTags: [{ accessTagOid: 5n }],
      authorization: { type: 'restricted' } as any
    });

    expect(mocks.assertSkillWriteAccess).not.toHaveBeenCalled();
  });

  it('requires manage access on the skill when the group grants manage access', async () => {
    let skill = { oid: 3n, id: 'skl_1', store: { oid: 6n } };
    mocks.getSkillGroupById.mockResolvedValue({
      oid: 2n,
      id: 'skg_1',
      allowConsumerSkillAssignment: true
    });
    mocks.getSkillById.mockResolvedValue(skill);
    mocks.getSkillGroupAccessLevel.mockResolvedValue('read');
    mocks.getHighestGrantedAccessLevel.mockResolvedValue('manage');
    mocks.assertStoreAccess.mockRejectedValue(new Error('forbidden'));

    await expect(
      assertConsumerCanWriteSkillGroupItem({
        instance,
        project,
        skillGroupId: 'skg_1',
        skillId: skill.id,
        action: 'add',
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 5n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('forbidden');

    expect(mocks.assertStoreAccess).toHaveBeenCalledWith({
      project,
      store: skill.store,
      authorization: { type: 'restricted' },
      level: 'manage'
    });
  });
});
