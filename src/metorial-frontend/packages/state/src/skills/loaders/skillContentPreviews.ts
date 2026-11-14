import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let maxSkillContentPreviewIds = 50;

export let skillContentPreviewsLoader = createLoader({
  name: 'skillContentPreviews',
  fetch: (i: { instanceId: string; skillIds: string[]; skillTemplateIds: string[] }) =>
    withAuth(sdk =>
      sdk.skills.contentPreviews.list(i.instanceId, {
        skillId: i.skillIds,
        skillTemplateId: i.skillTemplateIds
      })
    ),
  mutators: {}
});

let normalizeIds = (ids: string[] | undefined) => [...new Set(ids ?? [])].sort();

export let useSkillContentPreviews = (
  instanceId: string | null | undefined,
  ids: { skillIds?: string[]; skillTemplateIds?: string[] }
) => {
  let skillIds = normalizeIds(ids.skillIds).slice(0, maxSkillContentPreviewIds);
  let skillTemplateIds = normalizeIds(ids.skillTemplateIds).slice(
    0,
    maxSkillContentPreviewIds - skillIds.length
  );

  let data = skillContentPreviewsLoader.use(
    instanceId && (skillIds.length || skillTemplateIds.length)
      ? { instanceId, skillIds, skillTemplateIds }
      : null
  );

  let items = data.data?.items ?? [];
  let contentBySkillId = new Map(
    items.flatMap(preview =>
      preview.skillId ? [[preview.skillId, preview.content] as const] : []
    )
  );
  let contentBySkillTemplateId = new Map(
    items.flatMap(preview =>
      preview.skillTemplateId ? [[preview.skillTemplateId, preview.content] as const] : []
    )
  );

  return {
    ...data,
    getContent: (skillId: string) => contentBySkillId.get(skillId) ?? null,
    getTemplateContent: (skillTemplateId: string) =>
      contentBySkillTemplateId.get(skillTemplateId) ?? null
  };
};
