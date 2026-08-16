import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getSkillGroupById: vi.fn(),
  getSkillById: vi.fn(),
  assertSkillWriteAccess: vi.fn()
}));

vi.mock('@metorial/cargo-module-skill', () => ({
  skillGroupService: {
    getSkillGroupById: mocks.getSkillGroupById
  },
  skillService: {
    getSkillById: mocks.getSkillById,
    assertSkillWriteAccess: mocks.assertSkillWriteAccess
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
        consumerProfile: { oid: 4n } as any,
        accessTags: [{ accessTagOid: 5n }],
        authorization: { type: 'restricted' } as any
      })
    ).rejects.toThrow('inactive group');
  });
});
