import { Hash } from '@lowerdeck/hash';
import { slugify } from '@lowerdeck/slugify';
import { db, env } from '@metorial-cargo/db';
import semver from 'semver';
import { internalImageService } from '../../internal/image';
import { assertSkillPluginSkillLimit } from '../../lib/limits';
import { createApplicator } from '../_lib/apply';
import type { PluginSerializerInput } from '../_lib/types';

export let getPluginPath = (d: PluginSerializerInput) =>
  d.skillMarketplacePlugin ? `plugins/${d.skillMarketplacePlugin.pluginSlug}` : undefined;

let json = (data: any) => JSON.stringify(data, null, 2);

export let applyPlugin = createApplicator(
  'plugin',
  async input => {
    let skills = await db.skillPluginSkill.findMany({
      where: {
        skillPluginOid: input.skillPlugin.oid,
        status: 'active',
        skill: {
          status: 'active'
        }
      },
      include: {
        skill: {
          include: { store: true }
        }
      },
      orderBy: { id: 'asc' }
    });
    await assertSkillPluginSkillLimit({
      skillPluginOid: input.skillPlugin.oid
    });

    let skillHashes = skills
      .map(s =>
        [
          1,
          s.oid,
          s.skill.oid,
          s.updatedAt.getTime(),
          s.skill.updatedAt.getTime(),
          s.skill.store.lastEditedAt.getTime()
        ].join(':')
      )
      .join('|');

    let hash = await Hash.sha256(
      [1, input.skillPlugin.oid, input.skillPlugin.updatedAt.getTime(), skillHashes].join(':')
    );

    return {
      skills,
      hash
    };
  },
  {
    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { skills, hash }) => {
      if (input.skillPlugin.versionHash !== hash) {
        let nextVersion = semver.inc(input.skillPlugin.version ?? '0.0.0', 'patch')!;

        await db.skillPlugin.updateMany({
          where: { oid: input.skillPlugin.oid },
          data: {
            versionHash: hash,
            version: nextVersion,

            // Force updatedAt not to change
            updatedAt: input.skillPlugin.updatedAt
          }
        });

        input.skillPlugin.version = nextVersion;
      }

      context.setBasePath(getPluginPath(input));

      let mcpServers = {
        metorial: {
          type: 'http',
          url: `${env.service.API_URL}/connect/plugin/${input.skillPlugin.slug}`
        }
      };
      let mcpJson = json(mcpServers);
      await context.setFile('mcp.json', mcpJson);
      await context.setFile('.mcp.json', mcpJson);

      let image = input.skillPlugin.image;
      if (image?.type !== 'file') {
        for (let skill of skills) {
          if (skill.skill.image?.type === 'file') {
            image = skill.skill.image;
          }
        }
      }
      if (image?.type !== 'file') {
        let tenant = await db.tenant.findFirstOrThrow({
          where: { oid: input.skillPlugin.tenantOid }
        });
        if (tenant.image?.type === 'file') {
          image = tenant.image;
        }
      }

      let downloadImage = await internalImageService.downloadImage({
        id: input.skillPlugin.id,
        image
      });
      let logoIcon = `assets/logo.${downloadImage.extension}`;
      await context.setFile(logoIcon, await downloadImage.fetch());

      let baseInfo = {
        name: slugify(
          (input.skillMarketplacePlugin?.pluginSlug ?? input.skillPlugin.name).replaceAll(
            '_',
            '-'
          )
        ),
        description: input.skillPlugin.description,
        version: input.skillPlugin.version,
        author: {
          name: 'Metorial',
          email: 'hey@metorial.com'
        },
        mcpServers
      };

      let claudePlugin = json(baseInfo);
      await context.setFile('.claude-plugin/plugin.json', claudePlugin);

      let cursorPlugin = json(baseInfo);
      await context.setFile('.cursor-plugin/plugin.json', cursorPlugin);

      let copilotPlugin = json({
        ...baseInfo,
        skills: 'skills/',
        agents: 'agents/',
        mcpServers: '.mcp.json'
      });
      await context.setFile('plugin.json', copilotPlugin);

      let codexPlugin = json({
        ...baseInfo,
        skills: './skills/',
        mcpServers: './.mcp.json',
        interface: {
          displayName: input.skillPlugin.name,
          shortDescription: input.skillPlugin.description,
          longDescription: input.skillPlugin.longDescription,
          capabilities: ['Interactive', 'Write', 'Read'],
          brandColor: '#0099ff',
          composerIcon: `./${logoIcon}`,
          logo: `./${logoIcon}`,
          screenshots: []
        }
      });
      await context.setFile('.codex-plugin/plugin.json', codexPlugin);

      // Standalone plugins are a single-plugin marketplace, so we still need to
      // create the marketplace files for them.
      if (!input.skillMarketplace) {
        let tenant = await db.tenant.findFirstOrThrow({
          where: { oid: input.skillPlugin.tenantOid }
        });

        let codexMarketplace = json({
          name: baseInfo.name,
          interface: {
            displayName: input.skillPlugin.name
          },
          plugins: [
            {
              name: baseInfo.name,
              category: input.skillPlugin.category ?? 'Productivity',
              source: {
                source: 'local',
                path: `./`
              },
              policy: {
                installation: 'AVAILABLE',
                authentication: 'ON_INSTALL'
              }
            }
          ]
        });
        await context.setFile('.agents/plugins/marketplace.json', codexMarketplace);

        let cursorAndClaudeMarketplace = json({
          name: baseInfo.name,
          owner: {
            name: tenant.organizationName ?? tenant.name
          },
          metadata: {
            description: 'Official WorkOS skills for AI coding agents',
            version: input.skillPlugin.version
          },
          plugins: [
            {
              name: baseInfo.name,
              source: `./`,
              description:
                input.skillPlugin.description ?? input.skillPlugin.longDescription ?? ''
            }
          ]
        });
        await context.setFile('.cursor-plugin/marketplace.json', cursorAndClaudeMarketplace);
        await context.setFile('.claude-plugin/marketplace.json', cursorAndClaudeMarketplace);
        await context.setFile('.github/plugin/marketplace.json', cursorAndClaudeMarketplace);
      }

      let cursor: string | null = null;
      let limit = 25;

      while (true) {
        let agents = await db.skillAgent.findMany({
          where: {
            skillOid: { in: skills.map(s => s.skill.oid) },
            status: 'active',
            id: cursor ? { gt: cursor } : undefined
          },
          include: { document: { include: { content: true } } },
          take: limit
        });

        for (let agent of agents) {
          await context.setFile(`agents/${agent.slug}.md`, agent.document.content.content);
        }

        if (agents.length < limit) break;
        cursor = agents[agents.length - 1]!.id as string;
      }
    }
  }
);
