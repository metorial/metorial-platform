import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { slugify } from '@lowerdeck/slugify';
import { getConfig } from '@metorial/config';
import { db } from '@metorial/db';
import { internalImageService } from '@metorial/skills-images';
import { assertSkillPluginSkillLimit } from '../../lib/limits';
import { getWithheldSkillIds } from '../../lib/securityReviewPolicy';
import { createApplicator } from '../_lib/apply';
import { claimVersion } from '../_lib/claimVersion';
import { getMarketplaceForceSyncHashInput } from '../_lib/forceSync';
import {
  getPluginAgentPath,
  getPluginLogoPath,
  getPluginPath,
  getPluginPruneScope,
  marketplaceManifestPaths,
  pluginAgentsDir,
  pluginManifestPaths,
  pluginSkillsDir
} from '../_lib/paths';

export { getPluginPath };

let json = (data: any) => JSON.stringify(data, null, 2);

export let applyPlugin = createApplicator(
  'plugin',
  async input => {
    let pluginSkills = await db.skillPluginSkill.findMany({
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
        },
        skillConfiguration: true
      },
      orderBy: { id: 'asc' }
    });
    await assertSkillPluginSkillLimit({
      skillPluginOid: input.skillPlugin.oid
    });

    let withheldSkillIds = await getWithheldSkillIds({
      projectOid: input.skillPlugin.projectOid,
      instanceOid: input.skillPlugin.instanceOid,
      skills: pluginSkills,
      configs: [
        input.skillPlugin.skillConfiguration,
        input.skillMarketplacePlugin?.skillConfiguration,
        input.skillMarketplace?.skillConfiguration
      ]
    });
    let skills = pluginSkills.filter(entry => !withheldSkillIds.has(entry.skill.id));

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
    let isCustomImage = (candidate: typeof image | null | undefined) =>
      candidate?.type === 'file' || candidate?.type === 'icon';

    if (!isCustomImage(image)) {
      for (let skill of skills) {
        if (isCustomImage(skill.skill.image)) image = skill.skill.image;
      }
    }
    if (!isCustomImage(image) && project.organization.image?.type === 'file') {
      image = project.organization.image;
    }
    let plugin = {
      slug: input.skillPlugin.slug,
      name: input.skillPlugin.name,
      description: input.skillPlugin.description,
      longDescription: input.skillPlugin.longDescription,
      category: input.skillPlugin.category,
      image
    };
    let agentHashInput = agents.map(agent => ({
      slug: agent.slug,
      content: agent.document.content.content
    }));
    let mcpUrl = `${getConfig().urls.apiUrl}/connect/plugin/${input.skillPlugin.slug}`;

    let hash = await Hash.sha256(
      canonicalize({
        serializerVersion: 3,
        ...getMarketplaceForceSyncHashInput(input.skillMarketplace),
        plugin,
        marketplacePluginSlug: input.skillMarketplacePlugin?.pluginSlug,
        standaloneMarketplace: input.skillMarketplace
          ? null
          : {
              ownerName: project.organization.name
            },
        agents: agentHashInput,
        withheldSkillIds: [...withheldSkillIds].sort(),
        mcpUrl
      })
    );

    // The version lives on the plugin and is shared by every destination publishing it, so it
    // must only depend on plugin content. Destination-specific inputs belong in `hash` alone.
    let versionHash = await Hash.sha256(
      canonicalize({
        plugin,
        ownerName: project.organization.name,
        agents: agentHashInput,
        mcpUrl
      })
    );

    return {
      skills,
      project,
      agents,
      image,
      hash,
      versionHash
    };
  },
  {
    getPruneScope: getPluginPruneScope,

    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { project, agents, image, versionHash }) => {
      let claimed = await claimVersion({
        initial: input.skillPlugin,
        hash: versionHash,
        compareAndSet: async d => {
          let updated = await db.skillPlugin.updateMany({
            where: {
              oid: input.skillPlugin.oid,
              versionHash: d.expectedVersionHash
            },
            data: {
              versionHash: d.versionHash,
              version: d.version,
              updatedAt: input.skillPlugin.updatedAt
            }
          });
          return updated.count > 0;
        },
        reload: () =>
          db.skillPlugin.findUniqueOrThrow({
            where: { oid: input.skillPlugin.oid },
            select: { version: true, versionHash: true }
          })
      });

      input.skillPlugin.version = claimed.version;
      input.skillPlugin.versionHash = claimed.versionHash;

      context.setBasePath(getPluginPath(input));

      let mcpServers = {
        metorial: {
          type: 'http',
          url: `${getConfig().urls.apiUrl}/connect/plugin/${input.skillPlugin.slug}`
        }
      };
      let mcpJson = json(mcpServers);
      await context.setFile(pluginManifestPaths.mcp, mcpJson);
      await context.setFile(pluginManifestPaths.dotMcp, mcpJson);

      let downloadImage = await internalImageService.downloadImage({
        id: input.skillPlugin.id,
        image
      });
      let logoIcon = getPluginLogoPath(downloadImage.extension);
      await context.setFile(logoIcon, await downloadImage.fetch());

      let baseInfo = {
        name: slugify((input.skillPlugin.name ?? input.skillPlugin.id).replaceAll('_', '-')),
        description: input.skillPlugin.description,
        version: input.skillPlugin.version,
        author: {
          name: 'Metorial',
          email: 'hey@metorial.com'
        },
        mcpServers
      };

      let claudePlugin = json(baseInfo);
      await context.setFile(pluginManifestPaths.claude, claudePlugin);

      let cursorPlugin = json(baseInfo);
      await context.setFile(pluginManifestPaths.cursor, cursorPlugin);

      let copilotPlugin = json({
        ...baseInfo,
        skills: `${pluginSkillsDir}/`,
        agents: `${pluginAgentsDir}/`,
        mcpServers: pluginManifestPaths.dotMcp
      });
      await context.setFile(pluginManifestPaths.copilot, copilotPlugin);

      let codexPlugin = json({
        ...baseInfo,
        skills: `./${pluginSkillsDir}/`,
        mcpServers: `./${pluginManifestPaths.dotMcp}`,
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
      await context.setFile(pluginManifestPaths.codex, codexPlugin);

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
        await context.setFile(marketplaceManifestPaths.codex, codexMarketplace);

        let cursorAndClaudeMarketplace = json({
          name: baseInfo.name,
          owner: {
            name: project.organization.name
          },
          metadata: {
            description:
              input.skillPlugin.description ?? input.skillPlugin.longDescription ?? '',
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
        await context.setFile(marketplaceManifestPaths.cursor, cursorAndClaudeMarketplace);
        await context.setFile(marketplaceManifestPaths.claude, cursorAndClaudeMarketplace);
        await context.setFile(marketplaceManifestPaths.github, cursorAndClaudeMarketplace);
      }

      for (let agent of agents) {
        await context.setFile(getPluginAgentPath(agent.slug), agent.document.content.content);
      }
    }
  }
);
