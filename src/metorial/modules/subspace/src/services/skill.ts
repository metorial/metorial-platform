import { db, type Instance } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillService = createSubspaceService(
  subspace.skill,
  ['hydrateResources', 'syncResourceTarget'],
  inner => ({
    syncResourceTarget: async (d: { instance: Instance; skillId: string }) => {
      let skill = await db.skill.findFirstOrThrow({
        where: {
          id: d.skillId,
          instanceOid: d.instance.oid
        },
        include: {
          parentSkill: { select: { id: true } },
          parentSkillTemplate: { select: { id: true } }
        }
      });

      await inner.syncResourceTarget({
        instance: d.instance,
        id: skill.id,
        status: skill.status,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        metadata: skill.metadata as any,
        image: skill.image as any,
        clientName: skill.clientName,
        clientDescription: skill.clientDescription,
        clientMetadata: skill.clientMetadata as any,
        license: skill.license,
        compatibility: skill.compatibility,
        storeId: skill.storeId,
        parentSkillId: skill.parentSkill?.id,
        parentType: skill.parentSkill ? 'duplicate' : undefined,
        parentTemplateId: skill.parentSkillTemplate?.id
      });
    }
  })
);

export type SubspaceSkillResourceHydration = Awaited<
  ReturnType<typeof subspace.skill.hydrateResources>
>[number];
export type SubspaceProviderPreview = SubspaceSkillResourceHydration['providers'][number];
export type SubspaceIntegrationPreview =
  SubspaceSkillResourceHydration['integrations'][number];
