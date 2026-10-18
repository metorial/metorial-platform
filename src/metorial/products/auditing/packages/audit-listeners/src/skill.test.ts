import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/db', () => ({ addAfterTransactionHook }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import {
  recordSkillArchived,
  recordSkillGroupSkillAdded,
  recordSkillGroupUpdated,
  recordSkillMergeRequestMerged,
  recordSkillTemplateArchived,
  recordSkillCreated,
  recordSkillMarketplaceUpdated,
  recordSkillPluginCreated,
  recordSkillUpdated
} from './skill';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let skill = {
  id: 'skl_1',
  name: 'Writer',
  slug: 'writer-abc',
  description: 'Writes',
  status: 'active',
  license: null,
  compatibility: null,
  metadata: { secret: 'value' }
} as any;

describe('skill audit listeners', () => {
  beforeEach(() => {
    recordEvent.mockClear();
  });

  it('records skill creation with its origin and without metadata', async () => {
    await recordSkillCreated({
      auditScope,
      skill,
      parentSkillId: 'skl_0',
      parentSkillTemplateId: null,
      cloneType: 'fork'
    });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect(resource).toBe('skill');
    expect(action).toBe('create');
    expect(data.payload).toMatchObject({
      id: 'skl_1',
      parentSkillId: 'skl_0',
      cloneType: 'fork'
    });
    expect(data.payload).not.toHaveProperty('metadata');
  });

  it('records skill updates with the previous state', async () => {
    await recordSkillUpdated({
      auditScope,
      skill,
      previousSkill: { ...skill, name: 'Old' }
    });

    let [, , action, data] = recordEvent.mock.calls[0]!;
    expect(action).toBe('update');
    expect(data.payload.name).toBe('Writer');
    expect(data.previousPayload.name).toBe('Old');
  });

  it('records skill archival', async () => {
    await recordSkillArchived({ auditScope, skill });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill', 'archive']);
    expect(data.payload.status).toBe('archived');
  });

  it('records skill plugin creation', async () => {
    await recordSkillPluginCreated({
      auditScope,
      skillPlugin: {
        id: 'spl_1',
        name: 'Plugin',
        slug: 'plugin',
        description: null,
        category: null,
        status: 'active'
      } as any
    });

    let [, resource, action] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill_plugin', 'create']);
  });

  it('records skill marketplace updates', async () => {
    let marketplace = {
      id: 'smk_1',
      name: 'Market',
      slug: 'market',
      description: null,
      status: 'active',
      repositoryAccessMode: 'pull_request',
      forceMergeOrPush: false,
      mergeBeforeChecksPass: false
    } as any;
    await recordSkillMarketplaceUpdated({
      auditScope,
      skillMarketplace: { ...marketplace, forceMergeOrPush: true },
      previousSkillMarketplace: marketplace
    });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill_marketplace', 'update']);
    expect(data.payload.forceMergeOrPush).toBe(true);
    expect(data.previousPayload.forceMergeOrPush).toBe(false);
  });

  it('records skill group updates with the previous skill list', async () => {
    let group = {
      id: 'sgr_1',
      name: 'Group',
      description: null,
      status: 'active',
      allowConsumerSkillAssignment: true,
      skillIds: ['skl_1']
    };
    await recordSkillGroupUpdated({
      auditScope,
      skillGroup: { ...group, skillIds: ['skl_1', 'skl_2'] },
      previousSkillGroup: group
    });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill_group', 'update']);
    expect(data.payload.skillIds).toEqual(['skl_1', 'skl_2']);
    expect(data.previousPayload.skillIds).toEqual(['skl_1']);
  });

  it('records a skill added to a group', async () => {
    await recordSkillGroupSkillAdded({ auditScope, skillGroupId: 'sgr_1', skillId: 'skl_2' });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill_group', 'add_skill']);
    expect(data.payload).toEqual({ id: 'sgr_1', skillId: 'skl_2' });
  });

  it('records skill template archival', async () => {
    await recordSkillTemplateArchived({
      auditScope,
      skillTemplate: {
        id: 'stp_1',
        name: 'T',
        slug: 't',
        description: null,
        status: 'active'
      }
    });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill_template', 'archive']);
    expect(data.payload.status).toBe('archived');
  });

  it('records merge request merges', async () => {
    await recordSkillMergeRequestMerged({
      auditScope,
      mergeRequest: {
        id: 'smr_1',
        title: 'Fix',
        status: 'merging',
        direction: 'fork_to_upstream',
        sourceSkillId: 'skl_2',
        targetSkillId: 'skl_1'
      }
    });

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['skill_merge_request', 'merge']);
    expect(data.payload.targetSkillId).toBe('skl_1');
  });
});
