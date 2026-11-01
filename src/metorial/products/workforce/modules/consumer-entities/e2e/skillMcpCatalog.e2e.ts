import {
  createRemoteProvider,
  expectOk,
  expectServiceError,
  mcp,
  metorialEndpoints,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerSurface } from '@metorial/db';
import { magicMcpEndpointService, magicMcpTokenService } from '@metorial/module-magic';
import { parseSkillDocumentFrontmatter } from '@metorial/module-skill/frontmatter';
import { skillGroupItemService, skillGroupService } from '@metorial/module-skill-groups';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  consumerIntegrationService,
  consumerSkillService,
  createSkillEditingTools,
  createSkillMcpCatalog
} from '../src';
import { createProfile, createSurface } from './_fixtures';

type Profile = Awaited<ReturnType<typeof createProfile>>;

type Catalog = NonNullable<Awaited<ReturnType<typeof createSkillMcpCatalog>>>;

let sha256 = (bytes: Uint8Array) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

let readBytes = async (catalog: Catalog, uri: string) => {
  let content = await catalog.readResource({ uri });
  if (!content) throw new Error(`Resource ${uri} not found`);

  return 'text' in content
    ? new TextEncoder().encode(content.text)
    : new Uint8Array(Buffer.from(content.blob, 'base64'));
};

let listAllSkills = async (catalog: Catalog) => {
  let skills: Awaited<ReturnType<Catalog['listSkills']>>['skills'] = [];
  let cursor: string | undefined;

  while (true) {
    let page = await catalog.listSkills({ cursor });
    skills.push(...page.skills);

    if (!page.nextCursor) return skills;
    cursor = page.nextCursor;
  }
};

describe('module-consumer-entities skills over MCP', () => {
  let org = useOrganization();
  let killSwitchOrg = useOrganization();
  let upstream = useMcpTestServer();

  let setup = async (fixture: OrganizationFixture) => {
    let surface = await createSurface(fixture, { allowConsumerSkillAuthoring: true });
    let author = await createProfile(fixture, surface);

    return { surface, author };
  };

  let editingTools = async (
    fixture: OrganizationFixture,
    profile: Profile,
    magicMcpEndpoint?: { oid: bigint }
  ) =>
    await createSkillEditingTools({
      instance: fixture.instance,
      consumerProfile: profile,
      magicMcpEndpoint,
      context: fixture.context
    });

  let catalogFor = async (
    fixture: OrganizationFixture,
    profile: Profile,
    magicMcpEndpoint?: { oid: bigint }
  ) => {
    let catalog = await createSkillMcpCatalog({
      instance: fixture.instance,
      consumerProfile: profile,
      magicMcpEndpoint,
      context: fixture.context
    });
    if (!catalog) throw new Error('Expected a skill catalog');

    return catalog;
  };

  let authorSkill = async (
    fixture: OrganizationFixture,
    surface: ConsumerSurface,
    author: Profile,
    name: string,
    files: Record<string, string> = {}
  ) => {
    let skill = await consumerSkillService.createConsumerSkill({
      organization: fixture.organization,
      instance: fixture.instance,
      project: fixture.project,
      auditScope: fixture.auditScope,
      consumerSurface: surface,
      consumerProfile: author,
      consumerGroups: [author.personalConsumerGroup!],
      input: { name, description: `${name} description` }
    });

    let tools = await editingTools(fixture, author);
    for (let [path, content] of Object.entries(files)) {
      await tools!.call('metorial_skill_write_file', { skill: skill.id, path, content });
    }

    return skill;
  };

  let createEndpoint = async (
    fixture: OrganizationFixture,
    profile: Profile,
    selection: { skillIds?: string[]; skillGroupIds?: string[] } | null
  ) => {
    let [skills, skillGroups] = await Promise.all([
      db.skill.findMany({ where: { id: { in: selection?.skillIds ?? [] } } }),
      db.skillGroup.findMany({ where: { id: { in: selection?.skillGroupIds ?? [] } } })
    ]);

    return await magicMcpEndpointService.createMagicMcpEndpoint({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        name: uniqueId('Skills Endpoint'),
        consumerProfile: profile,
        enableSkillResources: true,
        enableSkillEditing: true,
        skillSelection: selection ? { skills, skillGroups } : null
      }
    });
  };

  it('lists skills with digests and sizes that match the served bytes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    let name = uniqueId('Refund Desk');
    await authorSkill(fixture, surface, author, name, {
      '/references/policy.md': '# Policy\n\nRefund within 30 days.\n',
      '/scripts/check.py': 'print("ok")\n'
    });

    let catalog = await catalogFor(fixture, author);
    let skills = await listAllSkills(catalog);
    let entry = skills.find(skill => skill.frontmatter.description == `${name} description`);

    expect(entry).toBeDefined();
    expect(entry!.uri).toMatch(/^skill:\/\/[a-z0-9-]+\/SKILL\.md$/);

    let skillName = entry!.uri.split('/')[2];
    expect(entry!.frontmatter.name).toBe(skillName);
    expect(entry!.resources.map(resource => resource.uri).sort()).toEqual(
      [
        `skill://${skillName}/SKILL.md`,
        `skill://${skillName}/references/policy.md`,
        `skill://${skillName}/scripts/check.py`
      ].sort()
    );

    for (let resource of entry!.resources) {
      let bytes = await readBytes(catalog, resource.uri);

      expect(bytes.byteLength).toBe(resource.size);
      expect(sha256(bytes)).toBe(resource.digest);
    }

    let skillMd = new TextDecoder().decode(await readBytes(catalog, entry!.uri));
    expect(parseSkillDocumentFrontmatter(skillMd).frontmatter).toEqual(entry!.frontmatter);

    expect(await catalog.getSkill({ uri: entry!.uri })).toEqual(entry);
  });

  it('lists the direct children of skill directories', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    await authorSkill(fixture, surface, author, uniqueId('Templates'), {
      '/templates/invoice.md': '# Invoice\n',
      '/templates/regional/eu.md': '# EU\n'
    });

    let catalog = await catalogFor(fixture, author);
    let [entry] = await listAllSkills(catalog);
    let root = entry!.uri.replace(/\/SKILL\.md$/, '');

    let rootListing = await catalog.readDirectory({ uri: root });
    expect(rootListing?.resources.map(resource => resource.name).sort()).toEqual([
      'SKILL.md',
      'templates'
    ]);

    let templates = await catalog.readDirectory({ uri: `${root}/templates` });
    expect(templates?.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'invoice.md', mimeType: 'text/markdown' }),
        expect.objectContaining({
          uri: `${root}/templates/regional`,
          name: 'regional',
          mimeType: 'inode/directory'
        })
      ])
    );

    expect(await catalog.readDirectory({ uri: `${root}/templates/invoice.md` })).toBeNull();
    expect(await catalog.readDirectory({ uri: `${root}/missing` })).toBeNull();
  });

  it('changes the digest after an edit through the skill editing tools', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    let skill = await authorSkill(fixture, surface, author, uniqueId('Editable'), {
      '/notes.md': 'first\n'
    });

    let [before] = await listAllSkills(await catalogFor(fixture, author));
    let notesUri = before!.resources.find(resource => resource.uri.endsWith('/notes.md'))!.uri;

    let tools = await editingTools(fixture, author);
    await tools!.call('metorial_skill_write_file', {
      skill: skill.id,
      path: '/notes.md',
      content: 'second\n'
    });

    let after = await (await catalogFor(fixture, author)).getSkill({ uri: before!.uri });
    let beforeDigest = before!.resources.find(resource => resource.uri == notesUri)!.digest;
    let afterDigest = after!.resources.find(resource => resource.uri == notesUri)!.digest;

    expect(afterDigest).not.toBe(beforeDigest);
    expect(afterDigest).toBe(sha256(new TextEncoder().encode('second\n')));
  });

  it('never serves skills the consumer cannot read', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);
    let peer = await createProfile(fixture, surface);

    await authorSkill(fixture, surface, author, uniqueId('Private'));

    let [entry] = await listAllSkills(await catalogFor(fixture, author));
    let peerCatalog = await catalogFor(fixture, peer);

    expect(await listAllSkills(peerCatalog)).toEqual([]);
    expect(await peerCatalog.getSkill({ uri: entry!.uri })).toBeNull();
    expect(await peerCatalog.readResource({ uri: entry!.uri })).toBeNull();
  });

  it('serves only the selected skills and the skills in selected groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    let picked = await authorSkill(fixture, surface, author, uniqueId('Picked'));
    let grouped = await authorSkill(fixture, surface, author, uniqueId('Grouped'));
    let hidden = await authorSkill(fixture, surface, author, uniqueId('Hidden'));

    let group = await skillGroupService.createSkillGroup({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Group'), skillIds: [grouped.id] }
    });

    let endpoint = await createEndpoint(fixture, author, {
      skillIds: [picked.id],
      skillGroupIds: [group.id]
    });

    let descriptions = async () =>
      (await listAllSkills(await catalogFor(fixture, author, endpoint)))
        .map(skill => skill.frontmatter.description)
        .sort();

    expect(await descriptions()).toEqual(
      [`${picked.name} description`, `${grouped.name} description`].sort()
    );

    let [hiddenEntry] = (await listAllSkills(await catalogFor(fixture, author))).filter(
      skill => skill.frontmatter.description == `${hidden.name} description`
    );
    let scoped = await catalogFor(fixture, author, endpoint);

    expect(await scoped.getSkill({ uri: hiddenEntry!.uri })).toBeNull();
    expect(await scoped.readResource({ uri: hiddenEntry!.uri })).toBeNull();

    let tools = await editingTools(fixture, author, endpoint);
    expect(tools!.tools.map(tool => tool.key)).not.toContain('metorial_skill_create');
    expect(await tools!.call('metorial_skill_list', {})).toEqual({
      skills: expect.not.arrayContaining([expect.objectContaining({ id: hidden.id })])
    });

    let later = await authorSkill(fixture, surface, author, uniqueId('Later'));
    await skillGroupItemService.createSkillGroupItem({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { skillGroupId: group.id, skillId: later.id }
    });

    expect(await descriptions()).toContain(`${later.name} description`);
  });

  it('persists and presents the selection on the endpoint', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    let skill = await authorSkill(fixture, surface, author, uniqueId('Persisted'));
    let endpoint = await createEndpoint(fixture, author, { skillIds: [skill.id] });

    expect(endpoint.enableSkillResources).toBe(true);
    expect(endpoint.skillSelectionType).toBe('selected');
    expect(endpoint.skillSelections.map(selection => selection.skill?.id)).toEqual([skill.id]);

    let cleared = await magicMcpEndpointService.updateMagicMcpEndpoint({
      endpoint,
      auditScope: fixture.auditScope,
      input: { skillSelection: null }
    });

    expect(cleared.skillSelectionType).toBe('all');
    expect(cleared.skillSelections).toEqual([]);
    expect(
      await db.magicMcpEndpointSkillSelection.count({
        where: { magicMcpEndpointOid: endpoint.oid }
      })
    ).toBe(0);
  });

  it('serves nothing once every selected target is gone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    let skill = await authorSkill(fixture, surface, author, uniqueId('Removed'));
    await authorSkill(fixture, surface, author, uniqueId('Unselected'));

    let endpoint = await createEndpoint(fixture, author, { skillIds: [skill.id] });
    await db.magicMcpEndpointSkillSelection.deleteMany({
      where: { magicMcpEndpointOid: endpoint.oid }
    });

    expect(await listAllSkills(await catalogFor(fixture, author, endpoint))).toEqual([]);

    let tools = await editingTools(fixture, author, endpoint);
    expect(await tools!.call('metorial_skill_list', {})).toEqual({ skills: [] });
  });

  it('rejects an empty selection', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { author } = await setup(fixture);

    await expectServiceError(createEndpoint(fixture, author, {}), 'bad_request');
  });

  it('keeps serving skills when the project turns skill editing off', async () => {
    let fixture = await loadOrganizationFixture(killSwitchOrg.ids);
    let { surface, author } = await setup(fixture);

    await authorSkill(fixture, surface, author, uniqueId('Read Only'));

    await db.project.update({
      where: { oid: fixture.project.oid },
      data: { allowConsumerSkillEditing: false }
    });

    expect(await editingTools(fixture, author)).toBeNull();
    expect(await listAllSkills(await catalogFor(fixture, author))).toHaveLength(1);
  });

  it('serves skills over the hosted magic MCP endpoint', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, author } = await setup(fixture);

    let name = uniqueId('Hosted');
    await authorSkill(fixture, surface, author, name, { '/references/guide.md': '# Guide\n' });

    let { providerId } = await createRemoteProvider(org.clients.instance, {
      url: upstream.url
    });
    let server = expectOk(
      await org.clients.instance.post('/magic-mcp-servers', {
        name: uniqueId('Hosted Server')
      })
    );
    expectOk(
      await org.clients.instance.post(`/magic-mcp-servers/${server.id}/providers`, {
        provider_id: providerId
      })
    );

    let endpoint = await magicMcpEndpointService.createMagicMcpEndpoint({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        name: uniqueId('Hosted Endpoint'),
        consumerProfile: author,
        enableSkillResources: true,
        servers: [{ magicMcpServerId: server.id }]
      }
    });
    let token = await magicMcpTokenService.createMagicMcpToken({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { magicMcpEndpoint: endpoint }
    });
    await consumerIntegrationService.upsertConsumerToken({
      consumerProfile: author,
      magicMcpToken: token
    });

    let client = mcp(
      `${metorialEndpoints().mcp ?? metorialEndpoints().api}/connect/magic/${endpoint.slug}`,
      {
        apiKey: token.secret
      }
    );

    let init = await client.initialize();
    expect(init.result?.capabilities?.extensions).toEqual({
      'io.modelcontextprotocol/skills': { directoryRead: true }
    });

    let list = await client.request('skills/list');
    let entry = list.result?.skills?.find(
      (skill: any) => skill.frontmatter.description == `${name} description`
    );
    expect(entry).toBeDefined();

    for (let resource of entry.resources) {
      let read = await client.request('resources/read', { uri: resource.uri });
      let bytes = new TextEncoder().encode(read.result?.contents?.[0]?.text);

      expect(bytes.byteLength).toBe(resource.size);
      expect(sha256(bytes)).toBe(resource.digest);
    }

    let get = await client.request('skills/get', { uri: entry.uri });
    expect(get.result?.skill).toEqual(entry);

    let unknown = await client.request('skills/get', { uri: 'skill://missing/SKILL.md' });
    expect(unknown.error?.code).toBe(-32602);

    let tools = await client.listTools();
    expect(
      tools.result?.tools?.some((tool: any) => tool.name.startsWith('metorial_skill_'))
    ).toBe(false);
  }, 180_000);

  it('serves nothing to inactive consumers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { author } = await setup(fixture);

    await db.consumerProfile.update({
      where: { oid: author.oid },
      data: { status: 'deleted' }
    });

    expect(
      await createSkillMcpCatalog({
        instance: fixture.instance,
        consumerProfile: author,
        context: fixture.context
      })
    ).toBeNull();
  });
});
