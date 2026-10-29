import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let maxSkillContentPreviewIds = 50;

export let skillContentPreviewsLoader = createLoader({
  name: 'skillContentPreviews',
  fetch: (i: { instanceId: string; skillIds: string[] }) =>
    withAuth(sdk => sdk.skills.contentPreviews.list(i.instanceId, { id: i.skillIds })),
  mutators: {}
});

export let useSkillContentPreviews = (
  instanceId: string | null | undefined,
  skillIds: string[]
) => {
  let sortedSkillIds = [...new Set(skillIds)].sort().slice(0, maxSkillContentPreviewIds);

  let data = skillContentPreviewsLoader.use(
    instanceId && sortedSkillIds.length ? { instanceId, skillIds: sortedSkillIds } : null
  );

  let contentBySkillId = new Map(
    (data.data?.items ?? []).map(preview => [preview.skillId, preview.content])
  );

  return {
    ...data,
    getContent: (skillId: string) => contentBySkillId.get(skillId) ?? null
  };
};
