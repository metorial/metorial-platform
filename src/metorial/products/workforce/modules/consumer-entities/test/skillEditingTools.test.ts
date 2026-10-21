import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    instance: { findUniqueOrThrow: vi.fn() },
    consumerProfile: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    skill: { findMany: vi.fn() },
    skillPluginSkill: { findMany: vi.fn() }
  },
  isFlagEnabledForScope: vi.fn(),
  resolveConsumerProfileAccess: vi.fn(),
  createResourceAuthorization: vi.fn(),
  getSkillById: vi.fn(),
  listSkills: vi.fn(),
  listSkillFiles: vi.fn(),
  readSkillFileText: vi.fn(),
  applySkillFileChange: vi.fn(),
  createConsumerSkill: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db: mocks.db }));

vi.mock('@metorial/consumer-auth', () => ({
  consumerSessionInclude: { consumerProfile: { include: { surface: true } } },
  resolveConsumerProfileAccess: mocks.resolveConsumerProfileAccess
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForScope: mocks.isFlagEnabledForScope }
}));

vi.mock('@metorial/module-access', () => ({
  createResourceAuthorization: mocks.createResourceAuthorization
}));

vi.mock('@metorial/module-skill', () => ({
  skillService: { getSkillById: mocks.getSkillById, listSkills: mocks.listSkills },
  skillFileService: {
    listSkillFiles: mocks.listSkillFiles,
    readSkillFileText: mocks.readSkillFileText,
    applySkillFileChange: mocks.applySkillFileChange
  }
}));

vi.mock('../src/services/consumerSkill', () => ({
  consumerSkillService: { createConsumerSkill: mocks.createConsumerSkill }
}));

import { createSkillEditingTools } from '../src/lib/skillEditingTools';

let organization = { oid: 1n, id: 'org_1' };
let project = { oid: 2n, id: 'prj_1' };
let instance = { oid: 3n, id: 'ins_1', projectOid: 2n, organization, project };
let resourceActor = { oid: 4n, id: 'rac_1', projectOid: 2n, consumerProfileOid: 5n };
let consumerGroups = [{ oid: 6n, accessTagOid: 7n }];
let authorization = { type: 'restricted', resourceActor, accessTags: [7n] };
let context = { ip: '127.0.0.1', ua: 'test' };

let skill = {
  oid: 8n,
  id: 'skill_1',
  name: 'Writing',
  slug: 'writing',
  description: 'Helps with writing',
  store: { oid: 9n }
};

let file = {
  path: '/SKILL.md',
  kind: 'document',
  size: 12,
  etag: 'etag_1',
  storeItemId: 'sti_1',
  documentId: 'doc_1',
  fileId: null,
  updatedAt: new Date('2026-01-01T00:00:00Z')
};

let auditScope = {
  organizationOid: organization.oid,
  instanceOid: instance.oid,
  actor: { type: 'consumer_profile', id: 'cpf_1' },
  context
};

let consumerProfile = {
  oid: 5n,
  id: 'cpf_1',
  instanceOid: instance.oid,
  resourceActors: [resourceActor],
  surface: { allowConsumerSkillAuthoring: true }
};

let consumerProfileStatus = (
  d: {
    instanceOid?: bigint;
    status?: string;
    surfaceStatus?: string;
    portal?: { status: string } | null;
    allowConsumerSkillAuthoring?: boolean;
  } = {}
) => ({
  instanceOid: d.instanceOid ?? instance.oid,
  status: d.status ?? 'active',
  surface: {
    status: d.surfaceStatus ?? 'active',
    allowConsumerSkillAuthoring: d.allowConsumerSkillAuthoring ?? true,
    portal: d.portal === undefined ? { status: 'active' } : d.portal
  }
});

let createTools = (d: { skillPluginOid?: bigint } = {}) =>
  createSkillEditingTools({
    instance: { oid: instance.oid },
    consumerProfile: { oid: 5n },
    skillPluginOid: d.skillPluginOid,
    context
  });

let requireTools = async (d: { skillPluginOid?: bigint } = {}) => {
  let tools = await createTools(d);
  if (!tools) throw new Error('Expected skill editing tools');

  return tools;
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.db.instance.findUniqueOrThrow.mockResolvedValue(instance);
  mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfileStatus());
  mocks.db.consumerProfile.findUniqueOrThrow.mockResolvedValue(consumerProfile);
  mocks.db.skill.findMany.mockResolvedValue([skill]);
  mocks.db.skillPluginSkill.findMany.mockResolvedValue([]);

  mocks.isFlagEnabledForScope.mockResolvedValue(true);
  mocks.resolveConsumerProfileAccess.mockResolvedValue({
    ssoGroupIds: [],
    consumerGroups,
    accessTags: [7n],
    resourceActor,
    auditScope
  });
  mocks.createResourceAuthorization.mockReturnValue(authorization);
  mocks.getSkillById.mockResolvedValue(skill);
  mocks.listSkills.mockResolvedValue({
    run: vi.fn().mockResolvedValue({ items: [{ id: skill.id }] })
  });
  mocks.listSkillFiles.mockResolvedValue([file]);
  mocks.readSkillFileText.mockResolvedValue({ ...file, content: '# Writing' });
  mocks.applySkillFileChange.mockResolvedValue({
    type: 'put',
    path: '/SKILL.md',
    previousPath: null,
    file
  });
});

describe('skill editing tool list', () => {
  it('exposes the CLI skill tools with MCP compatible schemas', async () => {
    let tools = await requireTools();

    expect(tools.tools.map(tool => tool.key)).toEqual([
      'metorial_skill_list',
      'metorial_skill_create',
      'metorial_skill_get',
      'metorial_skill_read_file',
      'metorial_skill_write_file',
      'metorial_skill_delete_file',
      'metorial_skill_move_file'
    ]);

    for (let tool of tools.tools) {
      expect(tool.inputJsonSchema.type).toBe('object');
      expect(tool.description.length).toBeGreaterThan(0);
    }

    let byKey = new Map(tools.tools.map(tool => [tool.key, tool]));
    expect(byKey.get('metorial_skill_read_file')).toMatchObject({ readOnly: true });
    expect(byKey.get('metorial_skill_delete_file')).toMatchObject({ destructive: true });
    expect(byKey.get('metorial_skill_write_file')?.inputJsonSchema.required).toEqual([
      'skill',
      'path',
      'content'
    ]);
  });

  it('omits skill creation when the surface does not allow consumer skill authoring', async () => {
    mocks.db.consumerProfile.findUnique.mockResolvedValue(
      consumerProfileStatus({ allowConsumerSkillAuthoring: false })
    );

    let tools = await requireTools();

    expect(tools.tools.map(tool => tool.key)).not.toContain('metorial_skill_create');
    await expect(tools.call('metorial_skill_create', { name: 'New' })).rejects.toMatchObject({
      data: { status: 400 }
    });
    expect(mocks.createConsumerSkill).not.toHaveBeenCalled();
  });

  it('omits skill creation when the endpoint is scoped to a skill plugin', async () => {
    let tools = await requireTools({ skillPluginOid: 10n });

    expect(tools.tools.map(tool => tool.key)).not.toContain('metorial_skill_create');
  });

  it('returns no tools when skills are not enabled for the instance', async () => {
    mocks.isFlagEnabledForScope.mockResolvedValue(false);

    expect(await createTools()).toBeNull();
    expect(mocks.isFlagEnabledForScope).toHaveBeenCalledWith({
      organization,
      project,
      flag: 'skills-enabled'
    });
  });

  it.each([
    ['belongs to another instance', { instanceOid: 99n }],
    ['is not active', { status: 'archived' }],
    ['surface is not active', { surfaceStatus: 'archived' }],
    ['portal is not active', { portal: { status: 'archived' } }]
  ])('returns no tools when the consumer profile %s', async (_name, status) => {
    mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfileStatus(status));

    expect(await createTools()).toBeNull();
    expect(mocks.isFlagEnabledForScope).not.toHaveBeenCalled();
  });

  it('allows surfaces without a portal', async () => {
    mocks.db.consumerProfile.findUnique.mockResolvedValue(
      consumerProfileStatus({ portal: null })
    );

    expect(await createTools()).not.toBeNull();
  });

  it('does not resolve consumer access until a tool is called', async () => {
    await requireTools();

    expect(mocks.db.consumerProfile.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.resolveConsumerProfileAccess).not.toHaveBeenCalled();
    expect(mocks.createResourceAuthorization).not.toHaveBeenCalled();
  });
});

describe('skill editing tool log redaction', () => {
  it('replaces written content with its byte size', async () => {
    let tools = await requireTools();

    let redacted = tools.redactForLog({
      key: 'metorial_skill_write_file',
      input: { skill: 'skill_1', path: '/SKILL.md', content: 'héllo', if_match: 'etag_1' },
      output: { type: 'put', path: '/SKILL.md' }
    });

    expect(redacted).toEqual({
      input: {
        skill: 'skill_1',
        path: '/SKILL.md',
        content: { bytes: 6 },
        if_match: 'etag_1'
      },
      output: { type: 'put', path: '/SKILL.md' }
    });
  });

  it('marks read content as redacted and keeps the file metadata', async () => {
    let tools = await requireTools();

    let redacted = tools.redactForLog({
      key: 'metorial_skill_read_file',
      input: { skill: 'skill_1', path: '/SKILL.md' },
      output: {
        path: '/SKILL.md',
        kind: 'document',
        size: 9,
        etag: 'etag_1',
        binary: false,
        content: '# Writing'
      }
    });

    expect(redacted).toEqual({
      input: { skill: 'skill_1', path: '/SKILL.md' },
      output: {
        path: '/SKILL.md',
        kind: 'document',
        size: 9,
        etag: 'etag_1',
        content_redacted: true,
        content_bytes: 9
      }
    });
  });

  it('leaves binary read results without content untouched', async () => {
    let tools = await requireTools();
    let output = {
      path: '/logo.png',
      kind: 'file',
      size: 120,
      etag: 'etag_1',
      binary: true
    };

    let redacted = tools.redactForLog({
      key: 'metorial_skill_read_file',
      input: { skill: 'skill_1', path: '/logo.png' },
      output
    });

    expect(redacted.output).toEqual(output);
  });

  it('leaves other tools untouched', async () => {
    let tools = await requireTools();
    let entry = {
      key: 'metorial_skill_get',
      input: { skill: 'skill_1' },
      output: { files: [] }
    };

    expect(tools.redactForLog(entry)).toEqual({ input: entry.input, output: entry.output });
  });
});

describe('skill editing tool calls', () => {
  it('reads files with a restricted consumer authorization', async () => {
    let tools = await requireTools();

    let result = await tools.call('metorial_skill_read_file', {
      skill: 'writing',
      path: '/SKILL.md'
    });

    expect(result).toEqual({
      path: '/SKILL.md',
      kind: 'document',
      size: 12,
      etag: 'etag_1',
      binary: false,
      content: '# Writing'
    });
    expect(mocks.resolveConsumerProfileAccess).toHaveBeenCalledWith({
      consumerProfile,
      organization,
      project,
      instance,
      context
    });
    expect(mocks.createResourceAuthorization).toHaveBeenCalledWith({
      restricted: true,
      resourceActor,
      accessTags: [7n],
      project,
      instance,
      consumerProfile
    });
    expect(mocks.getSkillById).toHaveBeenCalledWith({
      project,
      instance,
      skillId: 'writing',
      accessTags: [7n]
    });
    expect(mocks.readSkillFileText).toHaveBeenCalledWith({
      project,
      instance,
      skill,
      authorization,
      path: '/SKILL.md',
      maxBytes: 256 * 1024
    });
  });

  it('builds the consumer authorization only once per request', async () => {
    let tools = await requireTools();

    await tools.call('metorial_skill_get', { skill: 'skill_1' });
    await tools.call('metorial_skill_read_file', { skill: 'skill_1', path: '/SKILL.md' });

    expect(mocks.resolveConsumerProfileAccess).toHaveBeenCalledTimes(1);
    expect(mocks.createResourceAuthorization).toHaveBeenCalledTimes(1);
  });

  it('reuses the instance loaded for the flag check', async () => {
    let tools = await requireTools();

    await tools.call('metorial_skill_get', { skill: 'skill_1' });

    expect(mocks.db.instance.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('returns the skill metadata and file tree', async () => {
    let tools = await requireTools();

    let result = await tools.call('metorial_skill_get', { skill: 'skill_1' });

    expect(result).toEqual({
      skill: {
        id: 'skill_1',
        name: 'Writing',
        slug: 'writing',
        description: 'Helps with writing'
      },
      files: [{ path: '/SKILL.md', kind: 'document', size: 12, etag: 'etag_1' }]
    });
  });

  it('flags binary content without returning it', async () => {
    let tools = await requireTools();
    mocks.readSkillFileText.mockResolvedValue({
      ...file,
      path: '/assets/logo.png',
      kind: 'file',
      content: null
    });

    let binary = await tools.call('metorial_skill_read_file', {
      skill: 'skill_1',
      path: '/assets/logo.png'
    });

    expect(binary).toEqual({
      path: '/assets/logo.png',
      kind: 'file',
      size: 12,
      etag: 'etag_1',
      binary: true
    });
  });

  it('passes too-large errors through to the model', async () => {
    let tools = await requireTools();
    mocks.readSkillFileText.mockRejectedValue(
      new ServiceError(
        badRequestError({ code: 'skill_file_too_large', message: 'too large to read inline' })
      )
    );

    await expect(
      tools.call('metorial_skill_read_file', { skill: 'skill_1', path: '/big.txt' })
    ).rejects.toMatchObject({ data: { status: 400, code: 'skill_file_too_large' } });
  });

  it('writes files with the consumer audit scope and if_match preconditions', async () => {
    let tools = await requireTools();

    let result = await tools.call('metorial_skill_write_file', {
      skill: 'skill_1',
      path: '/SKILL.md',
      content: '# Updated',
      if_match: 'etag_1'
    });

    expect(result).toEqual({
      type: 'put',
      path: '/SKILL.md',
      previous_path: null,
      file: { path: '/SKILL.md', kind: 'document', size: 12, etag: 'etag_1' }
    });
    expect(mocks.applySkillFileChange).toHaveBeenCalledWith({
      project,
      instance,
      skill,
      authorization,
      auditScope,
      change: { type: 'put', path: '/SKILL.md', content: '# Updated', ifMatch: 'etag_1' }
    });
  });

  it.each([
    { if_match: 'absent', ifMatch: null },
    { if_match: undefined, ifMatch: undefined }
  ])('maps write if_match %o', async ({ if_match, ifMatch }) => {
    let tools = await requireTools();

    await tools.call('metorial_skill_write_file', {
      skill: 'skill_1',
      path: '/notes.md',
      content: 'Notes',
      if_match
    });

    expect(mocks.applySkillFileChange).toHaveBeenCalledWith(
      expect.objectContaining({
        change: { type: 'put', path: '/notes.md', content: 'Notes', ifMatch }
      })
    );
  });

  it('moves and deletes files with etag preconditions only', async () => {
    let tools = await requireTools();

    await tools.call('metorial_skill_move_file', {
      skill: 'skill_1',
      path: '/a.md',
      to_path: '/b.md',
      if_match: 'etag_2'
    });
    await tools.call('metorial_skill_delete_file', { skill: 'skill_1', path: '/b.md' });

    expect(mocks.applySkillFileChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        change: { type: 'move', path: '/a.md', toPath: '/b.md', ifMatch: 'etag_2' }
      })
    );
    expect(mocks.applySkillFileChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        change: { type: 'delete', path: '/b.md', ifMatch: undefined }
      })
    );

    await expect(
      tools.call('metorial_skill_delete_file', {
        skill: 'skill_1',
        path: '/b.md',
        if_match: 'absent'
      })
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.applySkillFileChange).toHaveBeenCalledTimes(2);
  });

  it('explains how to recover when the file changed since it was read', async () => {
    mocks.applySkillFileChange.mockRejectedValue(
      new ServiceError(
        preconditionFailedError({
          code: 'skill_file_changed',
          message: 'The skill file "/SKILL.md" was changed by someone else since you read it'
        })
      )
    );
    let tools = await requireTools();

    await expect(
      tools.call('metorial_skill_write_file', {
        skill: 'skill_1',
        path: '/SKILL.md',
        content: '# Updated',
        if_match: 'stale'
      })
    ).rejects.toMatchObject({
      data: {
        status: 412,
        code: 'skill_file_changed',
        message:
          'The skill file "/SKILL.md" was changed by someone else since you read it; read it again, merge your edits and retry'
      }
    });
  });

  it.each([
    ['skill_file_exists', 'A file already exists at "/notes.md"'],
    ['skill_file_missing', 'The skill file "/notes.md" no longer exists']
  ])('passes %s conflicts through unchanged', async (code, message) => {
    mocks.applySkillFileChange.mockRejectedValue(
      new ServiceError(preconditionFailedError({ code, message }))
    );
    let tools = await requireTools();

    await expect(
      tools.call('metorial_skill_write_file', {
        skill: 'skill_1',
        path: '/notes.md',
        content: 'Notes',
        if_match: 'absent'
      })
    ).rejects.toMatchObject({ data: { status: 412, code, message } });
  });

  it('rejects invalid input and unknown tools', async () => {
    let tools = await requireTools();

    await expect(
      tools.call('metorial_skill_read_file', { skill: 'skill_1' })
    ).rejects.toMatchObject({ data: { status: 400, code: 'invalid_tool_input' } });
    await expect(tools.call('metorial_unknown', {})).rejects.toMatchObject({
      data: { status: 400 }
    });
  });

  it('lists skills visible to the consumer', async () => {
    let tools = await requireTools();

    let result = await tools.call('metorial_skill_list', { search: 'writ' });

    expect(result).toEqual({
      skills: [
        { id: 'skill_1', name: 'Writing', slug: 'writing', description: 'Helps with writing' }
      ]
    });
    expect(mocks.listSkills).toHaveBeenCalledWith({
      project,
      instance,
      search: 'writ',
      ids: undefined,
      accessTags: [7n]
    });
  });

  it('creates skills through the consumer skill service', async () => {
    mocks.createConsumerSkill.mockResolvedValue({ ...skill, id: 'skill_2', name: 'New' });
    let tools = await requireTools();

    let result = await tools.call('metorial_skill_create', {
      name: 'New',
      description: 'A new skill'
    });

    expect(result).toMatchObject({ id: 'skill_2', name: 'New' });
    expect(mocks.createConsumerSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        organization,
        project,
        instance,
        consumerGroups,
        consumerProfile,
        consumerSurface: consumerProfile.surface,
        auditScope,
        input: { name: 'New', description: 'A new skill', templateId: undefined }
      })
    );
  });
});

describe('skill plugin scoping', () => {
  beforeEach(() => {
    mocks.db.skillPluginSkill.findMany.mockResolvedValue([{ skill: { id: 'skill_1' } }]);
  });

  it('only lists the skills of the active plugin', async () => {
    let tools = await requireTools({ skillPluginOid: 10n });

    await tools.call('metorial_skill_list', {});

    expect(mocks.db.skillPluginSkill.findMany).toHaveBeenCalledWith({
      where: { skillPluginOid: 10n, status: 'active', skillPlugin: { status: 'active' } },
      select: { skill: { select: { id: true } } }
    });
    expect(mocks.listSkills).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['skill_1'], accessTags: [7n] })
    );
  });

  it('returns an empty list for a plugin without skills', async () => {
    mocks.db.skillPluginSkill.findMany.mockResolvedValue([]);
    let tools = await requireTools({ skillPluginOid: 10n });

    expect(await tools.call('metorial_skill_list', {})).toEqual({ skills: [] });
    expect(mocks.listSkills).not.toHaveBeenCalled();
  });

  it('rejects skills outside of the plugin', async () => {
    mocks.getSkillById.mockResolvedValue({ ...skill, id: 'skill_other' });
    let tools = await requireTools({ skillPluginOid: 10n });

    await expect(
      tools.call('metorial_skill_write_file', {
        skill: 'skill_other',
        path: '/SKILL.md',
        content: '# Other'
      })
    ).rejects.toMatchObject({ data: { status: 404 } });
    expect(mocks.applySkillFileChange).not.toHaveBeenCalled();
  });

  it('allows the skills of the plugin by slug', async () => {
    let tools = await requireTools({ skillPluginOid: 10n });

    await tools.call('metorial_skill_get', { skill: 'writing' });

    expect(mocks.getSkillById).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: 'writing' })
    );
    expect(mocks.listSkillFiles).toHaveBeenCalled();
  });
});
