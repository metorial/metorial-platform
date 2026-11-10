import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  Prisma,
  type Instance,
  type Project,
  type StoreParticipantPermissions,
  type StoreTemplateItemEncoding
} from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  skillRootDocumentPath,
  storeAccessService,
  storeReadPermission
} from '@metorial/module-store';

let maxPreviewCharacters = 6000;
export let maxSkillContentPreviewIds = 50;

export type SkillContentPreview =
  | { type: 'skill'; skillId: string; content: string | null }
  | { type: 'skill_template'; skillTemplateId: string; content: string | null };

let decodeTemplateItemContent = (item: {
  content: string | null;
  encoding: StoreTemplateItemEncoding | null;
}) => {
  if (item.content === null) return null;

  let content =
    item.encoding === 'base64'
      ? Buffer.from(item.content, 'base64').toString('utf8')
      : item.content;

  return content.slice(0, maxPreviewCharacters);
};

class SkillContentPreviewServiceImpl {
  private async listStoreRootDocumentContents(storeOids: bigint[]) {
    if (!storeOids.length) return new Map<bigint, string>();

    let rows = await db.$queryRaw<{ storeOid: bigint; content: string }[]>`
      SELECT si."storeOid", left(dc."content", ${maxPreviewCharacters}) AS "content"
      FROM "StoreItem" si
      JOIN "Document" doc ON doc."oid" = si."documentOid"
      JOIN "DocumentContent" dc ON dc."oid" = doc."contentOid"
      WHERE si."storeOid" IN (${Prisma.join(storeOids)})
        AND si."path" = ${skillRootDocumentPath}
    `;

    return new Map(rows.map(row => [row.storeOid, row.content]));
  }

  async listSkillContentPreviews(d: {
    project: Project;
    instance: Instance;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    skillIds: string[];
    skillTemplateIds: string[];
  }): Promise<SkillContentPreview[]> {
    let requestedCount = d.skillIds.length + d.skillTemplateIds.length;
    if (requestedCount > maxSkillContentPreviewIds) {
      throw new ServiceError(
        badRequestError({
          message: `At most ${maxSkillContentPreviewIds} skill and skill template IDs can be requested at once`
        })
      );
    }

    if (!requestedCount) return [];

    let [skills, skillTemplates] = await Promise.all([
      d.skillIds.length
        ? db.skill.findMany({
            where: {
              id: { in: d.skillIds },
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
              status: { not: 'deleted' },
              storeOid: { not: null }
            },
            select: { id: true, storeOid: true }
          })
        : [],
      d.skillTemplateIds.length
        ? db.skillTemplate.findMany({
            where: {
              id: { in: d.skillTemplateIds },
              status: { not: 'deleted' },
              storeTemplate: {
                is: {
                  OR: [
                    { projectOid: d.project.oid, instanceOid: d.instance.oid },
                    { projectOid: null, instanceOid: null }
                  ]
                }
              }
            },
            select: {
              id: true,
              storeTemplate: {
                select: {
                  type: true,
                  sourceStoreOid: true,
                  items: {
                    where: { path: skillRootDocumentPath },
                    select: { content: true, encoding: true }
                  }
                }
              }
            }
          })
        : []
    ]);

    let skillStoreOids = new Map(
      skills.flatMap(skill => (skill.storeOid ? [[skill.id, skill.storeOid] as const] : []))
    );
    let templateStoreOids = new Map(
      skillTemplates.flatMap(template =>
        template.storeTemplate?.type === 'linked_store' &&
        template.storeTemplate.sourceStoreOid
          ? [[template.id, template.storeTemplate.sourceStoreOid] as const]
          : []
      )
    );

    let storeOids = [...skillStoreOids.values(), ...templateStoreOids.values()];
    let access = storeOids.length
      ? await storeAccessService.resolveAccessibleStoreOids({
          project: d.project,
          instance: d.instance,
          authorization: d.authorization,
          defaultPermissions: d.defaultPermissions,
          overridePermissions: d.overridePermissions,
          requiredPermission: storeReadPermission,
          storeOids
        })
      : { accessibleStoreOids: [] as bigint[] };

    let accessibleStoreOids = new Set(access.accessibleStoreOids);
    let contentByStoreOid = await this.listStoreRootDocumentContents(
      storeOids.filter(storeOid => accessibleStoreOids.has(storeOid))
    );
    let skillTemplatesById = new Map(skillTemplates.map(template => [template.id, template]));

    let skillPreviews = d.skillIds.flatMap((skillId): SkillContentPreview[] => {
      let storeOid = skillStoreOids.get(skillId);
      if (!storeOid || !accessibleStoreOids.has(storeOid)) return [];

      return [{ type: 'skill', skillId, content: contentByStoreOid.get(storeOid) ?? null }];
    });

    let skillTemplatePreviews = d.skillTemplateIds.flatMap(
      (skillTemplateId): SkillContentPreview[] => {
        let template = skillTemplatesById.get(skillTemplateId);
        if (!template?.storeTemplate) return [];

        let storeOid = templateStoreOids.get(skillTemplateId);
        if (storeOid) {
          if (!accessibleStoreOids.has(storeOid)) return [];

          return [
            {
              type: 'skill_template',
              skillTemplateId,
              content: contentByStoreOid.get(storeOid) ?? null
            }
          ];
        }

        let rootItem = template.storeTemplate.items[0];

        return [
          {
            type: 'skill_template',
            skillTemplateId,
            content: rootItem ? decodeTemplateItemContent(rootItem) : null
          }
        ];
      }
    );

    return [...skillPreviews, ...skillTemplatePreviews];
  }
}

export let skillContentPreviewService = Service.create(
  'skillContentPreviewService',
  () => new SkillContentPreviewServiceImpl()
).build();
