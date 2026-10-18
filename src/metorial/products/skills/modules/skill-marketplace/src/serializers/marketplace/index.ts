import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { db } from '@metorial/db';
import { assertSkillMarketplaceLimits } from '../../lib/limits';
import { createApplicator } from '../_lib/apply';
import { claimVersion } from '../_lib/claimVersion';
import { getMarketplaceForceSyncHashInput } from '../_lib/forceSync';
import { getMarketplacePruneScope } from '../_lib/paths';

let json = (data: any) => JSON.stringify(data, null, 2);

export let applyMarketplace = createApplicator(
  'marketplace',
  async input => {
    let plugins = await db.skillMarketplacePlugin.findMany({
      where: {
        skillMarketplaceOid: input.skillMarketplace.oid,
        status: 'active',
        skillPlugin: {
          status: 'active'
        }
      },
      include: {
        skillPlugin: {
          include: {
            skillPluginSkills: {
              where: {
                status: 'active',
                skill: {
                  status: 'active',
                  description: { not: null }
                }
              },
              include: { skill: true },
              orderBy: { id: 'asc' }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    });
    await assertSkillMarketplaceLimits({
      skillMarketplaceOid: input.skillMarketplace.oid
    });

    let project = await db.project.findFirstOrThrow({
      where: { oid: input.skillMarketplace.projectOid },
      include: {
        organization: {
          select: { name: true, image: true }
        }
      }
    });
    let hash = await Hash.sha256(
      canonicalize({
        serializerVersion: 3,
        ...getMarketplaceForceSyncHashInput(input.skillMarketplace),
        marketplace: {
          slug: input.skillMarketplace.slug,
          name: input.skillMarketplace.name,
          ownerName: project.organization.name
        },
        plugins: plugins.map(plugin => ({
          slug: plugin.pluginSlug,
          category: plugin.skillPlugin.category ?? 'Productivity',
          description:
            plugin.skillPlugin.description ??
            plugin.skillPlugin.skillPluginSkills[0]?.skill.description ??
            ''
        }))
      })
    );

    return {
      plugins,
      project,
      hash
    };
  },
  {
    getPruneScope: getMarketplacePruneScope,

    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { plugins, project, hash }) => {
      let claimed = await claimVersion({
        initial: input.skillMarketplace,
        hash,
        compareAndSet: async d => {
          let updated = await db.skillMarketplace.updateMany({
            where: {
              oid: input.skillMarketplace.oid,
              versionHash: d.expectedVersionHash
            },
            data: {
              versionHash: d.versionHash,
              version: d.version,
              updatedAt: input.skillMarketplace.updatedAt
            }
          });
          return updated.count > 0;
        },
        reload: () =>
          db.skillMarketplace.findUniqueOrThrow({
            where: { oid: input.skillMarketplace.oid },
            select: { version: true, versionHash: true }
          })
      });

      input.skillMarketplace.version = claimed.version;
      input.skillMarketplace.versionHash = claimed.versionHash;

      let codexMarketplace = json({
        name: input.skillMarketplace.slug,
        interface: {
          displayName: input.skillMarketplace.name
        },
        plugins: plugins.map(p => ({
          name: p.pluginSlug,
          category: p.skillPlugin.category ?? 'Productivity',
          source: {
            source: 'local',
            path: `./plugins/${p.pluginSlug}`
          },
          policy: {
            installation: 'AVAILABLE',
            authentication: 'ON_INSTALL'
          }
        }))
      });
      await context.setFile('.agents/plugins/marketplace.json', codexMarketplace);

      let claudeMarketplace = json({
        name: input.skillMarketplace.slug,
        owner: {
          name: project.organization.name
        },
        metadata: {
          description: input.skillMarketplace.description ?? '',
          version: input.skillMarketplace.version
        },
        plugins: plugins.map(p => ({
          name: p.pluginSlug,
          source: `./plugins/${p.pluginSlug}`,
          description:
            p.skillPlugin.description ??
            p.skillPlugin.skillPluginSkills[0]?.skill.description ??
            ''
        }))
      });
      await context.setFile('.claude-plugin/marketplace.json', claudeMarketplace);
      await context.setFile('.github/plugin/marketplace.json', claudeMarketplace);

      let cursorMarketplace = json({
        name: input.skillMarketplace.slug,
        owner: {
          name: project.organization.name
        },
        metadata: {
          description: input.skillMarketplace.description ?? '',
          version: input.skillMarketplace.version
        },
        plugins: plugins.map(p => ({
          name: p.pluginSlug,
          source: p.pluginSlug,
          description:
            p.skillPlugin.description ??
            p.skillPlugin.skillPluginSkills[0]?.skill.description ??
            ''
        }))
      });
      await context.setFile('.cursor-plugin/marketplace.json', cursorMarketplace);
    }
  }
);
