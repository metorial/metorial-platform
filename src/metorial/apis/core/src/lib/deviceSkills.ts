import { v } from '@lowerdeck/validation';
import type { Instance, Project } from '@metorial/db';
import type { AnyAccessTagSelector } from '@metorial/module-access';
import { skillService } from '@metorial/module-skill';

export let maxReportedSkills = 500;

let skillIdPattern = /^skl_[0-9A-Za-z]{1,60}$/;

let skillNamePattern = /^[0-9A-Za-z][0-9A-Za-z_-]{0,63}$/;

export let reportedSkillsValidator = v.array(
  v.object({
    skill_id: v.string({
      name: 'skill_id',
      description: 'The Metorial skill installed under this name.',
      examples: ['skl_0mhNnEqM7XQb3vXq8gD2'],
      modifiers: [v.regex(skillIdPattern)]
    }),
    name: v.string({
      name: 'name',
      description:
        'The name of the skill directory, which AI tools report the skill by: letters, digits, dashes and underscores, at most 64 characters.',
      examples: ['billing-playbook'],
      modifiers: [v.regex(skillNamePattern)]
    })
  }),
  {
    name: 'skills',
    description: `Skills the app installed on this device. Replaces the stored list; when omitted, the stored list is kept. Skills you cannot access are ignored. At most ${maxReportedSkills}.`,
    modifiers: [v.maxLength(maxReportedSkills)]
  }
);

type DeviceSkillsContext = {
  project: Project;
  instance: Instance;
  accessTags?: AnyAccessTagSelector;
};

export let grantableDeviceSkills = async (
  ctx: DeviceSkillsContext,
  reported: { skill_id: string; name: string }[] | undefined
) => {
  if (!reported) return undefined;

  let ids = [...new Set(reported.map(skill => skill.skill_id))];
  let grantable = ids.length
    ? await skillService.listSkillRecords({
        project: ctx.project,
        instance: ctx.instance,
        ids,
        accessTags: ctx.accessTags,
        select: { id: true },
        take: ids.length
      })
    : [];
  let grantableIds = new Set(grantable.map(skill => skill.id));

  return reported
    .filter(skill => grantableIds.has(skill.skill_id))
    .map(skill => ({ skillId: skill.skill_id, name: skill.name }));
};
