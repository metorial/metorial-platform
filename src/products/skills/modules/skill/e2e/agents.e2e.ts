import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { type SkillRecord, skillAgentService, skillVersionService } from '../src';
import { addDocument, createSkill, privileged, publishVersion } from './_fixtures';

let createAgent = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  input: { name: string; description?: string | null; content?: string }
) =>
  await skillAgentService.createSkillAgent({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skill,
    input: { ...input, authorization: privileged }
  });

let listAgents = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  opts: { includeArchived?: boolean } = {}
) =>
  await firstPage(
    await skillAgentService.listSkillAgents({
      project: fixture.project,
      instance: fixture.instance,
      skillId: skill.id,
      ...opts
    })
  );

let publishedContent = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  path: string
) => {
  let storeVersion = await publishVersion(skill);
  let [version] = await firstPage(
    await skillVersionService.listSkillVersions({
      project: fixture.project,
      instance: fixture.instance,
      skill,
      storeVersionIds: [storeVersion.id]
    })
  );
  let snapshot = await skillVersionService.getSkillVersionSnapshot({
    project: fixture.project,
    instance: fixture.instance,
    skill,
    skillVersionId: version!.id
  });

  return snapshot.items.find(item => item.path === path)?.content;
};

describe('module-skill agents', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates an agent document under /agents with generated content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    let agent = await createAgent(fixture, skill, {
      name: '  Code Reviewer  ',
      description: 'Reviews pull requests'
    });
    expect(agent).toMatchObject({
      name: 'Code Reviewer',
      slug: 'code-reviewer',
      description: 'Reviews pull requests',
      status: 'active',
      skill: { id: skill.id },
      storeItem: { path: '/agents/code-reviewer.md' }
    });
    expect(agent.document.id).toBeTruthy();

    let content = await publishedContent(fixture, skill, '/agents/code-reviewer.md');
    expect(content).toContain('Code Reviewer');
    expect(content).toContain('> Reviews pull requests');

    let fetched = await skillAgentService.getSkillAgentById({
      project: fixture.project,
      instance: fixture.instance,
      skillAgentId: agent.id
    });
    expect(fetched.id).toBe(agent.id);
    expect((await listAgents(fixture, skill)).map(item => item.id)).toEqual([agent.id]);
  });

  it('keeps provided content and strips a trailing .md from the slug', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    let agent = await createAgent(fixture, skill, {
      name: 'Planner.md',
      content: '# Planner\n\nPlan carefully.'
    });
    expect(agent.slug).toBe('planner');
    expect(agent.storeItem?.path).toBe('/agents/planner.md');
    expect(agent.description).toBeNull();

    expect(await publishedContent(fixture, skill, '/agents/planner.md')).toBe(
      '# Planner\n\nPlan carefully.'
    );
  });

  it('registers markdown documents added to /agents and rejects other files there', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    await addDocument(fixture, skill, '/agents/triage.md', '# Triage');
    let [agent] = await listAgents(fixture, skill);
    expect(agent).toMatchObject({
      name: 'triage.md',
      slug: 'triage',
      storeItem: { path: '/agents/triage.md' }
    });

    await expectServiceError(
      addDocument(fixture, skill, '/agents/notes.txt', 'not an agent'),
      'bad_request'
    );
    expect(await listAgents(fixture, skill)).toHaveLength(1);
  });

  it('rejects names without slug characters and empty updates', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    await expectServiceError(createAgent(fixture, skill, { name: '   ' }), 'bad_request');
    await expectServiceError(createAgent(fixture, skill, { name: '!!!' }), 'bad_request');
    expect(await db.skillAgent.count({ where: { skillOid: skill.oid } })).toBe(0);

    let agent = await createAgent(fixture, skill, { name: 'Writer' });
    let update = (input: { name?: string; description?: string | null }) =>
      skillAgentService.updateSkillAgent({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skillAgent: agent,
        authorization: privileged,
        input
      });

    await expectServiceError(update({}), 'bad_request');
    await expectServiceError(update({ name: '  ' }), 'bad_request');
    expect(await db.skillAgent.findUniqueOrThrow({ where: { id: agent.id } })).toMatchObject({
      name: 'Writer'
    });
  });

  it('renames an agent without moving its document and clears its description', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let agent = await createAgent(fixture, skill, { name: 'Writer', description: 'Drafts' });

    let updated = await skillAgentService.updateSkillAgent({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillAgent: agent,
      authorization: privileged,
      input: { name: ' Editor ', description: null }
    });
    expect(updated).toMatchObject({
      id: agent.id,
      name: 'Editor',
      description: null,
      storeItem: { path: '/agents/writer.md' }
    });
    expect(updated.document.id).toBe(agent.document.id);
  });

  it('archives an agent when it is deleted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let kept = await createAgent(fixture, skill, { name: 'Kept' });
    let agent = await createAgent(fixture, skill, { name: 'Removed' });

    let deleted = await skillAgentService.deleteSkillAgent({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillAgent: agent,
      authorization: privileged
    });
    expect(deleted).toMatchObject({ id: agent.id, status: 'archived', storeItem: null });
    expect(deleted.archivedAt).toBeInstanceOf(Date);

    expect(
      await db.storeItem.count({
        where: { store: { id: skill.storeId }, path: '/agents/removed.md' }
      })
    ).toBe(0);

    await expectServiceError(
      skillAgentService.getSkillAgentById({
        project: fixture.project,
        instance: fixture.instance,
        skillAgentId: agent.id
      }),
      'not_found'
    );
    let archived = await skillAgentService.getSkillAgentById({
      project: fixture.project,
      instance: fixture.instance,
      skillAgentId: agent.id,
      includeArchived: true
    });
    expect(archived.status).toBe('archived');

    expect((await listAgents(fixture, skill)).map(item => item.id)).toEqual([kept.id]);
    expect(
      (await listAgents(fixture, skill, { includeArchived: true })).map(item => item.id).sort()
    ).toEqual([kept.id, agent.id].sort());
  });

  it('keeps agents inside their organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let agent = await createAgent(fixture, skill, { name: 'Private' });

    await expectServiceError(
      skillAgentService.getSkillAgentById({
        project: other.project,
        instance: other.instance,
        skillAgentId: agent.id,
        includeArchived: true
      }),
      'not_found'
    );
    expect(await listAgents(other, skill, { includeArchived: true })).toEqual([]);

    await expectServiceError(createAgent(other, skill, { name: 'Intruder' }), 'bad_request');
    await expectServiceError(
      skillAgentService.updateSkillAgent({
        project: other.project,
        instance: other.instance,
        auditScope: other.auditScope,
        skillAgent: agent,
        authorization: privileged,
        input: { name: 'Hijacked' }
      }),
      'bad_request'
    );
    await expectServiceError(
      skillAgentService.deleteSkillAgent({
        project: other.project,
        instance: other.instance,
        auditScope: other.auditScope,
        skillAgent: agent,
        authorization: privileged
      }),
      'bad_request'
    );

    expect(await db.skillAgent.findUniqueOrThrow({ where: { id: agent.id } })).toMatchObject({
      name: 'Private',
      status: 'active'
    });
    expect(await listAgents(fixture, skill)).toHaveLength(1);
  });
});
