import { Hash } from '@lowerdeck/hash';
import { db } from '@metorial-cargo/db';
import semver from 'semver';
import { assertSkillMarketplaceLimits } from '../../lib/limits';
import { createApplicator } from '../_lib/apply';

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

    let pluginHashes = plugins
      .map(s =>
        [
          1,
          s.oid,
          s.skillPlugin.oid,
          s.updatedAt.getTime(),
          s.skillPlugin.updatedAt.getTime()
        ].join(':')
      )
      .join('|');

    let hash = await Hash.sha256(
      [
        1,
        input.skillMarketplace.oid,
        input.skillMarketplace.updatedAt.getTime(),
        pluginHashes
      ].join(':')
    );

    let tenant = await db.tenant.findFirstOrThrow({
      where: { oid: input.skillMarketplace.tenantOid }
    });

    return {
      plugins,
      tenant,
      hash
    };
  },
  {
    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { plugins, tenant, hash }) => {
      if (input.skillMarketplace.versionHash !== hash) {
        let nextVersion = semver.inc(input.skillMarketplace.version ?? '0.0.0', 'patch')!;

        await db.skillMarketplace.updateMany({
          where: { oid: input.skillMarketplace.oid },
          data: {
            versionHash: hash,
            version: nextVersion,

            // Force updatedAt not to change
            updatedAt: input.skillMarketplace.updatedAt
          }
        });

        input.skillMarketplace.version = nextVersion;
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
          name: tenant.organizationName ?? tenant.name
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
          name: tenant.organizationName ?? tenant.name
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
