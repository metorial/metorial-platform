import { metorialDb } from '@metorial-subspace/module-tenant';

let skillPluginSkillOf = (skillId: string) => ({
  skillPluginSkills: { some: { skill: { id: skillId } } }
});

// Mirrors the skill module's dirty propagation: the review runs in the integrations worker,
// where the skill module's queues aren't registered, so the destinations are marked directly
// and picked up by the dirty-destination cron.
export let markSkillDestinationsDirty = async (skillId: string) => {
  await metorialDb.skillDestination.updateMany({
    where: {
      OR: [
        { skillPlugin: skillPluginSkillOf(skillId) },
        {
          skillMarketplace: { plugins: { some: { skillPlugin: skillPluginSkillOf(skillId) } } }
        }
      ]
    },
    data: { isDirty: true, lastTransientChangeAt: new Date() }
  });
};
