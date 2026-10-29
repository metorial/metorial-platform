import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  Prisma,
  type Instance,
  type Project,
  type StoreParticipantPermissions
} from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  skillRootDocumentPath,
  storeAccessService,
  storeReadPermission
} from '@metorial/module-store';

let maxPreviewCharacters = 6000;
export let maxSkillContentPreviewIds = 50;

export type SkillContentPreview = {
  skillId: string;
  content: string | null;
};

class SkillContentPreviewServiceImpl {
  async listSkillContentPreviews(d: {
    project: Project;
    instance: Instance;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    skillIds: string[];
  }): Promise<SkillContentPreview[]> {
    if (d.skillIds.length > maxSkillContentPreviewIds) {
      throw new ServiceError(
        badRequestError({
          message: `At most ${maxSkillContentPreviewIds} skill IDs can be requested at once`
        })
      );
    }

    if (!d.skillIds.length) return [];

    let skills = await db.skill.findMany({
      where: {
        id: { in: d.skillIds },
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        status: { not: 'deleted' },
        storeOid: { not: null }
      },
      select: { id: true, storeOid: true }
    });
    let storedSkills = skills.flatMap(skill =>
      skill.storeOid ? [{ id: skill.id, storeOid: skill.storeOid }] : []
    );

    let access = await storeAccessService.resolveAccessibleStoreOids({
      project: d.project,
      instance: d.instance,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission,
      storeOids: storedSkills.map(skill => skill.storeOid)
    });

    let accessibleStoreOids = new Set(access.accessibleStoreOids);
    let accessibleSkills = storedSkills.filter(skill =>
      accessibleStoreOids.has(skill.storeOid)
    );
    if (!accessibleSkills.length) return [];

    let rows = await db.$queryRaw<{ storeOid: bigint; content: string }[]>`
      SELECT si."storeOid", left(dc."content", ${maxPreviewCharacters}) AS "content"
      FROM "StoreItem" si
      JOIN "Document" doc ON doc."oid" = si."documentOid"
      JOIN "DocumentContent" dc ON dc."oid" = doc."contentOid"
      WHERE si."storeOid" IN (${Prisma.join(accessibleSkills.map(skill => skill.storeOid))})
        AND si."path" = ${skillRootDocumentPath}
    `;

    let contentByStoreOid = new Map(rows.map(row => [row.storeOid, row.content]));
    let skillsById = new Map(accessibleSkills.map(skill => [skill.id, skill]));

    return d.skillIds.flatMap(skillId => {
      let skill = skillsById.get(skillId);
      if (!skill) return [];

      return [{ skillId, content: contentByStoreOid.get(skill.storeOid) ?? null }];
    });
  }
}

export let skillContentPreviewService = Service.create(
  'skillContentPreviewService',
  () => new SkillContentPreviewServiceImpl()
).build();
