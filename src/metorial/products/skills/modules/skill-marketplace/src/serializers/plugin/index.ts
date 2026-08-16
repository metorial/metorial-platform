import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { slugify } from '@lowerdeck/slugify';
import { getConfig } from '@metorial/config';
import { db } from '@metorial/db';
import semver from 'semver';
import { internalImageService } from '@metorial/skills-images';
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

    let project = await db.project.findFirstOrThrow({
      where: { oid: input.skillPlugin.projectOid },
      include: {
        organization: {
          select: { name: true, image: true }
        }
      }
    });
    let agents = await db.skillAgent.findMany({
      where: {
        skillOid: { in: skills.map(skill => skill.skill.oid) },
        status: 'active'
      },
      include: { document: { include: { content: true } } },
      orderBy: { id: 'asc' }
    });
    let image = input.skillPlugin.image;
    if (image?.type !== 'file') {
      for (let skill of skills) {
        if (skill.skill.image?.type === 'file') image = skill.skill.image;
      }
    }
    if (image?.type !== 'file' && project.organization.image?.type === 'file') {
      image = project.organization.image;
    }
    let legacySkillHashes = skills
      .map(skill =>
        [
          1,
          skill.oid,
          skill.skill.oid,
          skill.updatedAt.getTime(),
          skill.skill.updatedAt.getTime(),
          skill.skill.store!.lastEditedAt.getTime()
        ].join(':')
      )
      .join('|');
    let legacyHash = await Hash.sha256(
      [
        1,
        input.skillPlugin.oid,
        input.skillPlugin.updatedAt.getTime(),
        legacySkillHashes
      ].join(':')
    );

    // Hash only values that affect generated files. In particular, exclude
    // updatedAt and the generated version to make repository round-trips
    // idempotent.
    let hash = await Hash.sha256(
      canonicalize({
        serializerVersion: 2,
        plugin: {
          slug: input.skillPlugin.slug,
          name: input.skillPlugin.name,
          description: input.skillPlugin.description,
          longDescription: input.skillPlugin.longDescription,
          category: input.skillPlugin.category,
          image
        },
        marketplacePluginSlug: input.skillMarketplacePlugin?.pluginSlug,
        standaloneMarketplace: input.skillMarketplace
          ? null
          : {
              ownerName: project.organization.name
            },
        agents: agents.map(agent => ({
          slug: agent.slug,
          content: agent.document.content.content
        })),
        mcpUrl: `${getConfig().urls.apiUrl}/connect/plugin/${input.skillPlugin.slug}`
      })
    );

    return {
      skills,
      project,
      agents,
      image,
      hash,
      legacyHash
    };
  },
  {
    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { project, agents, image, hash, legacyHash }) => {
      if (input.skillPlugin.versionHash !== hash) {
        let isHashMigration = input.skillPlugin.versionHash === legacyHash;
        let nextVersion = isHashMigration
          ? input.skillPlugin.version
          : semver.inc(input.skillPlugin.version ?? '0.0.0', 'patch')!;

        let updated = await db.skillPlugin.updateMany({
          where: {
            oid: input.skillPlugin.oid,
            versionHash: input.skillPlugin.versionHash
          },
          data: {
            versionHash: hash,
            version: nextVersion,

            // Force updatedAt not to change
            updatedAt: input.skillPlugin.updatedAt
          }
        });

        if (updated.count > 0) {
          input.skillPlugin.version = nextVersion;
          input.skillPlugin.versionHash = hash;
        } else {
          let current = await db.skillPlugin.findUniqueOrThrow({
            where: { oid: input.skillPlugin.oid }
          });
          if (current.versionHash !== hash) {
            throw new Error('Plugin changed while its sync was being processed');
          }

          input.skillPlugin.version = current.version;
          input.skillPlugin.versionHash = current.versionHash;
        }
      }

      context.setBasePath(getPluginPath(input));

      let mcpServers = {
        metorial: {
          type: 'http',
          url: `${getConfig().urls.apiUrl}/connect/plugin/${input.skillPlugin.slug}`
        }
      };
      let mcpJson = json(mcpServers);
      await context.setFile('mcp.json', mcpJson);
      await context.setFile('.mcp.json', mcpJson);

      let downloadImage = await internalImageService.downloadImage({
        id: input.skillPlugin.id,
        image
      });
      let logoIcon = `assets/logo.${downloadImage.extension}`;
      await context.setFile(logoIcon, await downloadImage.fetch());

      let baseInfo = {
        name: slugify(
          (
            input.skillMarketplacePlugin?.pluginSlug ??
            input.skillPlugin.name ??
            input.skillPlugin.id
          ).replaceAll('_', '-')
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
            name: project.organization.name
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

      for (let agent of agents) {
        await context.setFile(`agents/${agent.slug}.md`, agent.document.content.content);
      }
    }
  }
);
