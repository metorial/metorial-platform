import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { db } from '@metorial/db';
import semver from 'semver';
import { assertSkillMarketplaceLimits } from '../../lib/limits';
import { createApplicator } from '../_lib/apply';
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
    let legacyPluginHashes = plugins
      .map(plugin =>
        [
          1,
          plugin.oid,
          plugin.skillPlugin.oid,
          plugin.updatedAt.getTime(),
          plugin.skillPlugin.updatedAt.getTime()
        ].join(':')
      )
      .join('|');
    let legacyHash = await Hash.sha256(
      [
        1,
        input.skillMarketplace.oid,
        input.skillMarketplace.updatedAt.getTime(),
        legacyPluginHashes
      ].join(':')
    );

    let hash = await Hash.sha256(
      canonicalize({
        serializerVersion: 2,
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
      hash,
      legacyHash
    };
  },
  {
    getPruneScope: getMarketplacePruneScope,

    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { plugins, project, hash, legacyHash }) => {
      if (input.skillMarketplace.versionHash !== hash) {
        let isHashMigration = input.skillMarketplace.versionHash === legacyHash;
        let nextVersion = isHashMigration
          ? input.skillMarketplace.version
          : semver.inc(input.skillMarketplace.version ?? '0.0.0', 'patch')!;

        let updated = await db.skillMarketplace.updateMany({
          where: {
            oid: input.skillMarketplace.oid,
            versionHash: input.skillMarketplace.versionHash
          },
          data: {
            versionHash: hash,
            version: nextVersion,
            updatedAt: input.skillMarketplace.updatedAt
          }
        });

        if (updated.count > 0) {
          input.skillMarketplace.version = nextVersion;
          input.skillMarketplace.versionHash = hash;
        } else {
          let current = await db.skillMarketplace.findUniqueOrThrow({
            where: { oid: input.skillMarketplace.oid }
          });
          if (current.versionHash !== hash) {
            throw new Error('Marketplace changed while its sync was being processed');
          }

          input.skillMarketplace.version = current.version;
          input.skillMarketplace.versionHash = current.versionHash;
        }
      }

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
          description: 'Official WorkOS skills for AI coding agents',
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
          description: 'Official WorkOS skills for AI coding agents',
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
