import { db } from '@metorial/db';
import { assertSkillMarketplaceLimits } from '../../lib/limits';
import { createApplicator } from '../_lib/apply';
import { claimVersion } from '../_lib/claimVersion';
import { getMarketplacePruneScope } from '../_lib/paths';
import {
  getLegacyMarketplaceVersionHash,
  getMarketplaceVersionHash,
  renderMarketplaceFiles
} from './render';

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
    let hashInput = {
      skillMarketplace: input.skillMarketplace,
      ownerName: project.organization.name,
      plugins
    };

    return {
      plugins,
      project,
      hash: await getMarketplaceVersionHash(hashInput),
      legacyHash: await getLegacyMarketplaceVersionHash(hashInput)
    };
  },
  {
    getPruneScope: getMarketplacePruneScope,

    getHash: async (_input, { hash }) => hash,

    apply: async (input, context, { plugins, project, hash, legacyHash }) => {
      let claimed = await claimVersion({
        initial: input.skillMarketplace,
        hash,
        legacyHashes: [legacyHash],
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

      let files = renderMarketplaceFiles({
        skillMarketplace: input.skillMarketplace,
        ownerName: project.organization.name,
        version: input.skillMarketplace.version,
        plugins
      });
      for (let file of files) await context.setFile(file.path, file.content);
    }
  }
);
