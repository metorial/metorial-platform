import { eventually, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { getConfig } from '@metorial/config';
import { skillAgentService, skillService } from '@metorial/module-skill';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseSkillDocumentFrontmatter, skillPluginService } from '../src';
import { applyMarketplace } from '../src/serializers/marketplace';
import { applyPlugin } from '../src/serializers/plugin';
import { applySkill } from '../src/serializers/skill';
import {
  addDocument,
  addSkillToPlugin,
  archivePlugin,
  createMarketplace,
  createPlugin,
  createSkill,
  createSkillConfiguration,
  editDocument,
  getPlugin,
  getSkill,
  loadMarketplaceSerializerInput,
  loadStandalonePluginSerializerInput,
  privileged,
  removePluginFromMarketplace,
  runSerializer,
  useFakeOrigin
} from './_fixtures';

describe('export serializers', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  let other = useOrganization();

  let fixture: OrganizationFixture;
  let otherFixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
    otherFixture = await loadOrganizationFixture(other.ids);
  });

  let createPluginWithLogo = async (
    target: OrganizationFixture,
    input: Parameters<typeof createPlugin>[1] = {},
    opts: Parameters<typeof createPlugin>[2] = {}
  ) => {
    let plugin = await createPlugin(target, input, opts);
    return await skillPluginService.updateSkillPlugin({
      project: target.project,
      instance: target.instance,
      auditScope: target.auditScope,
      skillPlugin: plugin,
      input: { image: { type: 'url', url: origin.logoUrl() } }
    });
  };

  let createSkillWithContent = async () => {
    let skill = await createSkill(fixture, {
      name: 'Pdf Tools',
      description: 'Works with PDFs'
    });
    let skillMd = await addDocument(
      fixture,
      skill,
      '/SKILL.md',
      '---\nname: ignored\nauthor: someone\nmetadata:\n  source: doc\n---\n# PDF Tools\n\nBody'
    );
    await addDocument(fixture, skill, '/references/Style Guide', '# Style');
    await addDocument(fixture, skill, '/references/data.json', '{}');
    await addDocument(fixture, skill, '/scripts/run.sh', 'echo hi');
    await addDocument(fixture, skill, '/notes/todo.md', 'todo');

    return { skill, skillMd };
  };

  let skillFilesFor = async (skillMarketplaceId: string) => {
    let input = (await loadMarketplaceSerializerInput(skillMarketplaceId)).plugins[0]!
      .skills[0]!;
    return await runSerializer(applySkill, input);
  };

  describe('skill output', () => {
    it('writes the skill under its plugin path with merged SKILL.md frontmatter', async () => {
      let { skill } = await createSkillWithContent();
      await skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, skill.id),
        authorization: privileged,
        input: {
          clientName: 'PDF Tools',
          clientDescription: 'Client facing description',
          clientMetadata: { owner: 'docs' },
          license: 'Apache-2.0'
        }
      });
      await skillAgentService.createSkillAgent({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, skill.id),
        input: { name: 'Triage Bot', content: '# Triage', authorization: privileged }
      });

      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(
        fixture,
        { name: 'Doc Suite' },
        { skillMarketplaceId: marketplace.id }
      );
      await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id,
        pluginSkillSlug: 'pdf-tools'
      });

      let output = await skillFilesFor(marketplace.id);
      let base = 'plugins/doc-suite/skills/pdf-tools';

      expect(output.paths()).toEqual([
        `${base}/SKILL.md`,
        `${base}/notes/todo.md`,
        `${base}/references/Style-Guide.md`,
        `${base}/references/data.json`,
        `${base}/scripts/run.sh`
      ]);

      let skillMd = output.files.get(`${base}/SKILL.md`)!;
      let parsed = parseSkillDocumentFrontmatter(skillMd);
      expect(parsed.frontmatter).toEqual({
        name: 'pdf-tools',
        author: 'someone',
        description: 'Client facing description',
        license: 'Apache-2.0',
        metadata: { owner: 'docs', source: 'doc' }
      });
      expect(parsed.body).toBe('# PDF Tools\n\nBody');
      expect(output.files.get(`${base}/references/Style-Guide.md`)).toBe('# Style');
    });

    it('adds frontmatter to a SKILL.md that has none and falls back to the skill description', async () => {
      let skill = await createSkill(fixture, {
        name: 'Plain Skill',
        description: 'Plain words'
      });
      await addDocument(fixture, skill, '/SKILL.md', '# Plain');
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let link = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id
      });

      let output = await skillFilesFor(marketplace.id);
      let membership = (await loadMarketplaceSerializerInput(marketplace.id)).plugins[0]!
        .skillMarketplacePlugin;
      let skillMd = output.files.get(
        `plugins/${membership.pluginSlug}/skills/${link.pluginSkillSlug}/SKILL.md`
      )!;

      expect(skillMd).toBe(
        '---\nname: plain-skill\ndescription: Plain words\nmetadata: {}\n---\n\n# Plain'
      );
    });

    it('filters content by the intersection of plugin, link, membership and marketplace configs', async () => {
      let { skill } = await createSkillWithContent();
      let noScripts = await createSkillConfiguration(fixture, { allowScripts: false });
      let standardOnly = await createSkillConfiguration(fixture, {
        allowNonStandardDirectories: false
      });
      let markdownOnly = await createSkillConfiguration(fixture, {
        allowedFileExtensions: ['.md', '.sh']
      });

      let marketplace = await createMarketplace(fixture, {
        skillConfigurationId: markdownOnly.id
      });
      let plugin = await createPlugin(
        fixture,
        { name: 'Filtered', skillConfigurationId: noScripts.id },
        { skillMarketplaceId: marketplace.id }
      );
      await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id,
        pluginSkillSlug: 'pdf-tools',
        skillConfigurationId: standardOnly.id
      });

      let output = await skillFilesFor(marketplace.id);
      expect(output.paths()).toEqual([
        'plugins/filtered/skills/pdf-tools/SKILL.md',
        'plugins/filtered/skills/pdf-tools/references/Style-Guide.md'
      ]);
    });

    it('keeps an extension allow-list when another config in the chain allows every extension', async () => {
      let { skill } = await createSkillWithContent();
      let restrictive = await createSkillConfiguration(fixture, {
        allowedFileExtensions: ['.md', '.json']
      });
      let permissive = await createSkillConfiguration(fixture, {});

      let marketplace = await createMarketplace(fixture, {
        skillConfigurationId: permissive.id
      });
      let plugin = await createPlugin(
        fixture,
        { name: 'Allow Listed', skillConfigurationId: restrictive.id },
        { skillMarketplaceId: marketplace.id }
      );
      await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id,
        pluginSkillSlug: 'pdf-tools'
      });

      let output = await skillFilesFor(marketplace.id);
      expect(output.paths()).toEqual([
        'plugins/allow-listed/skills/pdf-tools/SKILL.md',
        'plugins/allow-listed/skills/pdf-tools/notes/todo.md',
        'plugins/allow-listed/skills/pdf-tools/references/Style-Guide.md',
        'plugins/allow-listed/skills/pdf-tools/references/data.json'
      ]);
    });

    it('allows no extra files when the configured extension allow-lists are disjoint', async () => {
      let { skill } = await createSkillWithContent();
      let markdown = await createSkillConfiguration(fixture, {
        allowedFileExtensions: ['.md']
      });
      let json = await createSkillConfiguration(fixture, {});
      await db.skillConfiguration.update({
        where: { oid: json.oid },
        data: { allowedFileExtensions: ['.json'] }
      });

      let marketplace = await createMarketplace(fixture, { skillConfigurationId: json.id });
      let plugin = await createPlugin(
        fixture,
        { name: 'Disjoint', skillConfigurationId: markdown.id },
        { skillMarketplaceId: marketplace.id }
      );
      await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id,
        pluginSkillSlug: 'pdf-tools'
      });

      let output = await skillFilesFor(marketplace.id);
      expect(output.paths()).toEqual(['plugins/disjoint/skills/pdf-tools/SKILL.md']);
    });

    it('changes the skill hash when its content or effective config changes', async () => {
      let { skill, skillMd } = await createSkillWithContent();
      let marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
      let link = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id
      });

      let settledOutput = async () =>
        await eventually(
          async () => {
            let earlier = await skillFilesFor(marketplace.id);
            await new Promise(resolve => setTimeout(resolve, 1500));
            let later = await skillFilesFor(marketplace.id);
            expect(later.hash).toBe(earlier.hash);
            return later;
          },
          { timeoutMs: 45_000 }
        );

      let first = await settledOutput();
      let skillMdPath = first.paths().find(path => path.endsWith('/SKILL.md'))!;
      expect(skillMdPath).toMatch(new RegExp(`/skills/${link.pluginSkillSlug}/SKILL\\.md$`));

      await editDocument(fixture, skillMd.id, '# Edited');
      let edited = await eventually(
        async () => {
          let output = await skillFilesFor(marketplace.id);
          expect(output.hash).not.toBe(first.hash);
          return output;
        },
        { timeoutMs: 45_000 }
      );
      expect(edited.files.get(skillMdPath)).toContain('# Edited');

      let noScripts = await createSkillConfiguration(fixture, { allowScripts: false });
      await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: skill.id,
        skillConfigurationId: noScripts.id
      });
      let reconfigured = await skillFilesFor(marketplace.id);
      expect(reconfigured.hash).not.toBe(edited.hash);
      expect(reconfigured.paths().some(path => path.includes('/scripts/'))).toBe(false);
      expect(reconfigured.paths()).toContain(skillMdPath);
    });
  });

  describe('plugin output', () => {
    it('writes plugin manifests for every client and versions them by content', async () => {
      let skill = await createSkill(fixture);
      await skillAgentService.createSkillAgent({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await getSkill(fixture, skill.id),
        input: { name: 'Triage Bot', content: '# Triage', authorization: privileged }
      });
      let agent = await db.skillAgent.findFirstOrThrow({
        where: { skillOid: skill.oid, status: 'active' }
      });

      let marketplace = await createMarketplace(fixture);
      let plugin = await createPluginWithLogo(
        fixture,
        { name: 'Ops Pack', description: 'Ops helpers', longDescription: 'All the ops' },
        { skillMarketplaceId: marketplace.id }
      );
      await addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: skill.id });

      let render = async () => {
        let input = await loadMarketplaceSerializerInput(marketplace.id);
        let { skillPlugin, skillMarketplacePlugin } = input.plugins[0]!;
        return await runSerializer(applyPlugin, {
          skillPlugin,
          skillMarketplace: input.skillMarketplace,
          skillMarketplacePlugin
        });
      };

      let output = await render();
      let base = 'plugins/ops-pack';
      let mcpServers = {
        metorial: {
          type: 'http',
          url: `${getConfig().urls.apiUrl}/connect/plugin/${plugin.slug}`
        }
      };
      let baseInfo = {
        name: 'ops-pack',
        description: 'Ops helpers',
        version: '0.0.1',
        author: { name: 'Metorial', email: 'hey@metorial.com' },
        mcpServers
      };

      expect(output.paths()).toEqual(
        [
          `${base}/.claude-plugin/plugin.json`,
          `${base}/.codex-plugin/plugin.json`,
          `${base}/.cursor-plugin/plugin.json`,
          `${base}/.mcp.json`,
          `${base}/agents/${agent.slug}.md`,
          `${base}/assets/logo.svg`,
          `${base}/mcp.json`,
          `${base}/plugin.json`
        ].sort()
      );
      expect(output.json(`${base}/mcp.json`)).toEqual(mcpServers);
      expect(output.json(`${base}/.mcp.json`)).toEqual(mcpServers);
      expect(output.json(`${base}/.claude-plugin/plugin.json`)).toEqual(baseInfo);
      expect(output.json(`${base}/.cursor-plugin/plugin.json`)).toEqual(baseInfo);
      expect(output.json(`${base}/plugin.json`)).toEqual({
        ...baseInfo,
        skills: 'skills/',
        agents: 'agents/',
        mcpServers: '.mcp.json'
      });
      expect(output.json(`${base}/.codex-plugin/plugin.json`)).toMatchObject({
        ...baseInfo,
        skills: './skills/',
        mcpServers: './.mcp.json',
        interface: {
          displayName: 'Ops Pack',
          shortDescription: 'Ops helpers',
          longDescription: 'All the ops',
          composerIcon: './assets/logo.svg',
          logo: './assets/logo.svg'
        }
      });
      expect(output.files.get(`${base}/agents/${agent.slug}.md`)).toBe('# Triage');
      expect(output.files.get(`${base}/assets/logo.svg`)).toContain('<svg');

      let stored = await getPlugin(fixture, plugin.id);
      expect(stored.version).toBe('0.0.1');
      expect(stored.versionHash).toEqual(expect.any(String));

      let unchanged = await render();
      expect(unchanged.hash).toBe(output.hash);
      expect((await getPlugin(fixture, plugin.id)).version).toBe('0.0.1');

      let standalone = await runSerializer(
        applyPlugin,
        await loadStandalonePluginSerializerInput(plugin.id)
      );
      expect(standalone.hash).not.toBe(output.hash);
      expect(standalone.json('.claude-plugin/plugin.json')).toMatchObject({ version: '0.0.1' });
      expect(await getPlugin(fixture, plugin.id)).toMatchObject({
        version: '0.0.1',
        versionHash: stored.versionHash
      });

      await skillPluginService.updateSkillPlugin({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skillPlugin: stored,
        input: { description: 'Sharper ops helpers' }
      });
      let changed = await render();
      expect(changed.hash).not.toBe(output.hash);
      expect(changed.json(`${base}/.claude-plugin/plugin.json`)).toMatchObject({
        description: 'Sharper ops helpers',
        version: '0.0.2'
      });
      expect((await getPlugin(fixture, plugin.id)).version).toBe('0.0.2');
    });

    it('adds its own marketplace manifests to a standalone plugin', async () => {
      let plugin = await createPluginWithLogo(fixture, {
        name: 'Solo Pack',
        description: null,
        longDescription: 'Solo long description'
      });

      let output = await runSerializer(
        applyPlugin,
        await loadStandalonePluginSerializerInput(plugin.id)
      );

      expect(output.paths()).toEqual(
        [
          '.agents/plugins/marketplace.json',
          '.claude-plugin/marketplace.json',
          '.claude-plugin/plugin.json',
          '.codex-plugin/plugin.json',
          '.cursor-plugin/marketplace.json',
          '.cursor-plugin/plugin.json',
          '.github/plugin/marketplace.json',
          '.mcp.json',
          'assets/logo.svg',
          'mcp.json',
          'plugin.json'
        ].sort()
      );
      expect(output.json('.agents/plugins/marketplace.json')).toEqual({
        name: 'solo-pack',
        interface: { displayName: 'Solo Pack' },
        plugins: [
          {
            name: 'solo-pack',
            category: 'Productivity',
            source: { source: 'local', path: './' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }
          }
        ]
      });

      let marketplaceManifest = {
        name: 'solo-pack',
        owner: { name: fixture.organization.name },
        metadata: { description: 'Solo long description', version: '0.0.1' },
        plugins: [{ name: 'solo-pack', source: './', description: 'Solo long description' }]
      };
      expect(output.json('.cursor-plugin/marketplace.json')).toEqual(marketplaceManifest);
      expect(output.json('.claude-plugin/marketplace.json')).toEqual(marketplaceManifest);
      expect(output.json('.github/plugin/marketplace.json')).toEqual(marketplaceManifest);
    });

    it('gives same-named plugins of different organizations distinct MCP endpoints', async () => {
      let plugin = await createPlugin(fixture, { name: 'Shared Name Pack' });
      let foreign = await createPlugin(otherFixture, { name: 'Shared Name Pack' });

      expect(plugin.slug).toBe('shared-name-pack');
      expect(foreign.slug).toBe('shared-name-pack-2');
    });
  });

  describe('marketplace output', () => {
    it('lists only active plugins in every client manifest', async () => {
      let marketplace = await createMarketplace(fixture, { description: 'Team catalog' });
      await createPlugin(
        fixture,
        { name: 'Described', description: 'First plugin', category: 'ops' },
        { skillMarketplaceId: marketplace.id }
      );
      let undescribed = await createPlugin(
        fixture,
        { name: 'Undescribed', description: null },
        { skillMarketplaceId: marketplace.id }
      );
      let skill = await createSkill(fixture, { description: 'Described by its skill' });
      await addSkillToPlugin(fixture, { skillPluginId: undescribed.id, skillId: skill.id });

      let removed = await createPlugin(
        fixture,
        { name: 'Removed' },
        { skillMarketplaceId: marketplace.id }
      );
      let archived = await createPlugin(
        fixture,
        { name: 'Archived' },
        { skillMarketplaceId: marketplace.id }
      );
      let removedMembership = await db.skillMarketplacePlugin.findFirstOrThrow({
        where: { skillMarketplaceOid: marketplace.oid, skillPluginOid: removed.oid }
      });
      await removePluginFromMarketplace(fixture, removedMembership.id);
      await archivePlugin(fixture, archived.id);

      let { skillMarketplace } = await loadMarketplaceSerializerInput(marketplace.id);
      let output = await runSerializer(applyMarketplace, { skillMarketplace });

      expect(output.paths()).toEqual([
        '.agents/plugins/marketplace.json',
        '.claude-plugin/marketplace.json',
        '.cursor-plugin/marketplace.json',
        '.github/plugin/marketplace.json'
      ]);

      let byName = (items: { name: string; [key: string]: unknown }[]) =>
        [...items].sort((a, b) => a.name.localeCompare(b.name));

      let codex = output.json('.agents/plugins/marketplace.json');
      expect(codex.name).toBe(marketplace.slug);
      expect(byName(codex.plugins)).toEqual([
        {
          name: 'described',
          category: 'ops',
          source: { source: 'local', path: './plugins/described' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }
        },
        {
          name: 'undescribed',
          category: 'Productivity',
          source: { source: 'local', path: './plugins/undescribed' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }
        }
      ]);

      let claude = output.json('.claude-plugin/marketplace.json');
      expect(claude).toMatchObject({
        name: marketplace.slug,
        owner: { name: fixture.organization.name },
        metadata: { description: 'Team catalog', version: '0.0.1' }
      });
      expect(byName(claude.plugins)).toEqual([
        { name: 'described', source: './plugins/described', description: 'First plugin' },
        {
          name: 'undescribed',
          source: './plugins/undescribed',
          description: 'Described by its skill'
        }
      ]);
      expect(output.json('.github/plugin/marketplace.json')).toEqual(claude);

      let cursor = output.json('.cursor-plugin/marketplace.json');
      expect(byName(cursor.plugins).map(item => item.source)).toEqual([
        'described',
        'undescribed'
      ]);

      let stored = await db.skillMarketplace.findUniqueOrThrow({
        where: { oid: marketplace.oid }
      });
      expect(stored.version).toBe('0.0.1');
      expect(stored.versionHash).toBe(output.hash);
    });
  });
});
