import { generatePlainId } from '@lowerdeck/id';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { Skill } from '@metorial/db';
import { withTransaction } from '@metorial/db';

let releasedSlugLength = 20;

export let getPluginSkillSlugInput = (skill: Pick<Skill, 'id' | 'name' | 'clientName'>) =>
  (skill.clientName ?? skill.name ?? skill.id).replaceAll('_', '-');

let generatePluginSkillSlug = createSlugGenerator(
  async (slug, d: { skillPluginOid: bigint; skillPluginSkillOid?: bigint }) =>
    await withTransaction(
      async db =>
        !(await db.skillPluginSkill.findFirst({
          where: {
            skillPluginOid: d.skillPluginOid,
            pluginSkillSlug: slug,
            status: 'active',
            oid: d.skillPluginSkillOid ? { not: d.skillPluginSkillOid } : undefined
          },
          select: { oid: true }
        })),
      { ifExists: true }
    )
);

// Archived links keep their slug so removing and re-adding a skill keeps its folder. Only active
// links hold a slug, though: claiming one that an archived link still carries moves that link to
// a random slug, so a replacement skill with the same name keeps the original folder too. The
// sync deletes an archived link's files by their recorded item key, not by its current slug.
export let claimPluginSkillSlug = async (d: {
  skillPluginOid: bigint;
  input: string;
  skillPluginSkill?: { oid: bigint; pluginSkillSlug: string };
}) =>
  await withTransaction(async db => {
    let slug = await generatePluginSkillSlug(
      { input: d.input, current: d.skillPluginSkill?.pluginSkillSlug },
      { skillPluginOid: d.skillPluginOid, skillPluginSkillOid: d.skillPluginSkill?.oid }
    );

    let holder = await db.skillPluginSkill.findFirst({
      where: {
        skillPluginOid: d.skillPluginOid,
        pluginSkillSlug: slug,
        status: { not: 'active' },
        oid: d.skillPluginSkill ? { not: d.skillPluginSkill.oid } : undefined
      },
      select: { oid: true }
    });
    if (holder) {
      await db.skillPluginSkill.update({
        where: { oid: holder.oid },
        data: { pluginSkillSlug: generatePlainId(releasedSlugLength).toLowerCase() }
      });
    }

    return slug;
  });
