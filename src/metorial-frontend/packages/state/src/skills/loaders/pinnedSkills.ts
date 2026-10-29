import { useOrganizationConfig } from '../../organization/loaders/organizationConfig';

type PinnedSkillsConfig = { instances: Record<string, string[]> };

export let useInstancePinnedSkills = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined
) => {
  let config = useOrganizationConfig(organizationId, 'skills.pinned');
  let setConfig = config.useSetMutator();

  let value = (config.data?.value ?? { instances: {} }) as PinnedSkillsConfig;
  let skillIds = (instanceId && value.instances?.[instanceId]) || [];

  let setSkillIds = (next: string[]) => {
    if (!instanceId) return;

    return setConfig.mutate({
      value: { instances: { ...value.instances, [instanceId]: next } }
    });
  };

  return {
    ...config,
    skillIds,
    isPinned: (skillId: string) => skillIds.includes(skillId),
    pin: (skillId: string) =>
      skillIds.includes(skillId) ? undefined : setSkillIds([...skillIds, skillId]),
    unpin: (skillId: string) => setSkillIds(skillIds.filter(id => id != skillId))
  };
};
