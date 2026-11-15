import { createLock } from '@lowerdeck/lock';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { getConfig } from '@metorial/config';
import type { Skill } from '@metorial/db';
import { db, ID, Prisma, withTransaction } from '@metorial/db';
import { enqueueSkillPluginSkillLifecycle } from '../queues/lifecycle/skillPluginSkill';
import { assertSkillPluginCanAddSkills, CargoSkillLimitError } from './limits';

let skillGroupPluginLock = createLock({
  name: 'cargo/skill/group-plugin/membership',
  redisUrl: getConfig().redisUrl
});

let clearedSkillOverrides = {
  clientName: null,
  clientDescription: null,
  clientMetadata: null,
  license: null,
  compatibility: null,
  skillConfigurationOid: null
};

let getAvailablePluginSkillSlug = createSlugGenerator(
  async (slug, d: { takenSlugs: Set<string> }) => !d.takenSlugs.has(slug)
);

let getPluginSkillSlugInput = (skill: Pick<Skill, 'id' | 'name' | 'clientName'>) =>
  (skill.clientName ?? skill.name ?? skill.id).replaceAll('_', '-');

export let getSkillGroupPluginTargetSkills = async (d: { skillGroupOid: bigint }) => {
  let items = await db.skillGroupItem.findMany({
    where: {
      skillGroupOid: d.skillGroupOid,
      status: 'active',
      skill: { status: 'active' }
    },
    orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
    include: { skill: true }
  });

  return items.map(item => item.skill);
};

let checkSkillsFit = async (d: { skillPluginOid: bigint; skills: Skill[] }) => {
  try {
    await assertSkillPluginCanAddSkills(d);
    return null;
  } catch (error) {
    if (error instanceof CargoSkillLimitError) return error.message;
    throw error;
  }
};

// Every limit grows monotonically with the number of added skills, so the largest prefix of the
// group's (oldest-first) skills that still fits can be found by binary search.
let getFittingSkills = async (d: { skillPluginOid: bigint; skills: Skill[] }) => {
  let failure = await checkSkillsFit(d);
  if (!failure) return { fitting: d.skills, limitMessage: null };

  let low = 0;
  let high = d.skills.length - 1;
  while (low < high) {
    let mid = Math.ceil((low + high) / 2);
    let midFailure = await checkSkillsFit({ ...d, skills: d.skills.slice(0, mid) });

    if (midFailure) {
      high = mid - 1;
      failure = midFailure;
    } else {
      low = mid;
    }
  }

  return { fitting: d.skills.slice(0, low), limitMessage: failure };
};

// Limit checks read committed rows, so stale links are archived (and committed) before the
// capacity for new links is measured. Inside a caller's transaction every phase joins it instead.
export let reconcileSkillGroupPluginMembership = async (d: { skillGroupPluginOid: bigint }) =>
  await skillGroupPluginLock.usingLock(d.skillGroupPluginOid.toString(), async () => {
    let link = await withTransaction(
      async db =>
        await db.skillGroupPlugin.findUnique({
          where: { oid: d.skillGroupPluginOid },
          include: {
            skillPlugin: {
              include: { skillPluginSkills: true }
            }
          }
        }),
      { ifExists: true }
    );
    if (!link || link.skillPlugin.status !== 'active') return null;

    let targetSkills = await getSkillGroupPluginTargetSkills({
      skillGroupOid: link.skillGroupOid
    });
    let targetSkillOids = new Set(targetSkills.map(skill => skill.oid));
    let activeLinks = link.skillPlugin.skillPluginSkills.filter(
      pluginSkill => pluginSkill.status === 'active'
    );
    let staleLinks = activeLinks.filter(pluginSkill => !targetSkillOids.has(pluginSkill.skillOid));

    if (staleLinks.length) {
      await withTransaction(async db => {
        await db.skillPluginSkill.updateMany({
          where: { oid: { in: staleLinks.map(pluginSkill => pluginSkill.oid) } },
          data: { status: 'archived', ...clearedSkillOverrides }
        });

        for (let pluginSkill of staleLinks) {
          await enqueueSkillPluginSkillLifecycle({
            skillPluginSkillId: pluginSkill.id,
            event: 'archived'
          });
        }
      });
    }

    let linkedSkillOids = new Set(activeLinks.map(pluginSkill => pluginSkill.skillOid));
    let missingSkills = targetSkills.filter(skill => !linkedSkillOids.has(skill.oid));
    let { fitting, limitMessage } = await getFittingSkills({
      skillPluginOid: link.skillPluginOid,
      skills: missingSkills
    });
    let skippedSkills = missingSkills.slice(fitting.length);

    await withTransaction(async db => {
      let takenSlugs = new Set(
        link.skillPlugin.skillPluginSkills.map(pluginSkill => pluginSkill.pluginSkillSlug)
      );
      let existingLinks = new Map(
        link.skillPlugin.skillPluginSkills.map(pluginSkill => [pluginSkill.skillOid, pluginSkill])
      );

      for (let skill of fitting) {
        let existing = existingLinks.get(skill.oid);

        if (existing) {
          await db.skillPluginSkill.update({
            where: { oid: existing.oid },
            data: { status: 'active', ...clearedSkillOverrides }
          });
          await enqueueSkillPluginSkillLifecycle({
            skillPluginSkillId: existing.id,
            event: 'updated'
          });
          continue;
        }

        let pluginSkillSlug = await getAvailablePluginSkillSlug(
          { input: getPluginSkillSlugInput(skill) },
          { takenSlugs }
        );
        takenSlugs.add(pluginSkillSlug);

        let pluginSkill = await db.skillPluginSkill.create({
          data: {
            id: await ID.generateId('skillPluginSkill'),
            status: 'active',
            pluginSkillSlug,
            skillOid: skill.oid,
            skillPluginOid: link.skillPluginOid
          }
        });
        await enqueueSkillPluginSkillLifecycle({
          skillPluginSkillId: pluginSkill.id,
          event: 'created'
        });
      }

      await db.skillGroupPlugin.update({
        where: { oid: link.oid },
        data: {
          lastReconciledAt: new Date(),
          syncIssues: skippedSkills.length
            ? skippedSkills.map(skill => ({
                skillId: skill.id,
                reason: 'limit_exceeded' as const,
                message: limitMessage ?? 'A plugin or marketplace limit was reached.'
              }))
            : Prisma.DbNull
        }
      });
    });

    return {
      addedSkillCount: fitting.length,
      archivedSkillCount: staleLinks.length,
      skippedSkillCount: skippedSkills.length
    };
  });
