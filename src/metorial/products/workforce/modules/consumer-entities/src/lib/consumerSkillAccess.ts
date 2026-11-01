import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { once } from '@lowerdeck/once';
import { consumerSessionInclude, resolveConsumerProfileAccess } from '@metorial/consumer-auth';
import type { Context } from '@metorial/context';
import { db, type ConsumerProfile, type Instance, type MagicMcpEndpoint } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { flagService } from '@metorial/module-flags';
import { skillService } from '@metorial/module-skill';

export type ConsumerSkillAccessInput = {
  instance: Pick<Instance, 'oid'>;
  consumerProfile: Pick<ConsumerProfile, 'oid'>;
  skillPluginOid?: bigint | null;
  magicMcpEndpoint?: Pick<MagicMcpEndpoint, 'oid'> | null;
  context: Context;
};

let intersect = (a: Set<string> | null, b: Set<string> | null) => {
  if (!a) return b;
  if (!b) return a;

  return new Set([...a].filter(id => b.has(id)));
};

let getPluginSkillIds = async (skillPluginOid: bigint) => {
  let pluginSkills = await db.skillPluginSkill.findMany({
    where: {
      skillPluginOid,
      status: 'active',
      skillPlugin: { status: 'active' }
    },
    select: { skill: { select: { id: true } } }
  });

  return new Set(pluginSkills.map(entry => entry.skill.id));
};

let getSelectedSkillIds = async (
  selections: { skillOid: bigint | null; skillGroupOid: bigint | null }[]
) => {
  let skillOids = selections.flatMap(selection =>
    selection.skillOid ? [selection.skillOid] : []
  );
  let skillGroupOids = selections.flatMap(selection =>
    selection.skillGroupOid ? [selection.skillGroupOid] : []
  );

  let [skills, groupItems] = await Promise.all([
    skillOids.length
      ? db.skill.findMany({ where: { oid: { in: skillOids } }, select: { id: true } })
      : [],
    skillGroupOids.length
      ? db.skillGroupItem.findMany({
          where: {
            skillGroupOid: { in: skillGroupOids },
            status: 'active',
            skillGroup: { status: 'active' }
          },
          select: { skill: { select: { id: true } } }
        })
      : []
  ]);

  return new Set([...skills.map(skill => skill.id), ...groupItems.map(item => item.skill.id)]);
};

export let createConsumerSkillAccess = async (d: ConsumerSkillAccessInput) => {
  let consumerProfile = await db.consumerProfile.findUnique({
    where: { oid: d.consumerProfile.oid },
    select: {
      instanceOid: true,
      status: true,
      surface: {
        select: {
          status: true,
          allowConsumerSkillAuthoring: true,
          portal: { select: { status: true } }
        }
      }
    }
  });
  if (
    !consumerProfile ||
    consumerProfile.instanceOid !== d.instance.oid ||
    consumerProfile.status !== 'active' ||
    consumerProfile.surface.status !== 'active' ||
    (consumerProfile.surface.portal && consumerProfile.surface.portal.status !== 'active')
  ) {
    return null;
  }

  let instance = await db.instance.findUniqueOrThrow({
    where: { oid: d.instance.oid },
    include: { organization: true, project: true }
  });

  let skillsEnabled = await flagService.isFlagEnabledForScope({
    organization: instance.organization,
    project: instance.project,
    flag: 'skills-enabled'
  });
  if (!skillsEnabled) return null;

  let endpoint = d.magicMcpEndpoint
    ? await db.magicMcpEndpoint.findUnique({
        where: { oid: d.magicMcpEndpoint.oid },
        select: {
          status: true,
          skillSelectionType: true,
          skillSelections: { select: { skillOid: true, skillGroupOid: true } }
        }
      })
    : null;
  if (d.magicMcpEndpoint && endpoint?.status !== 'active') return null;

  let skillSelections =
    endpoint?.skillSelectionType === 'selected' ? endpoint.skillSelections : null;

  let getAccess = once(async () => {
    let [fullConsumerProfile, pluginSkillIds, selectedSkillIds] = await Promise.all([
      db.consumerProfile.findUniqueOrThrow({
        where: { oid: d.consumerProfile.oid },
        include: consumerSessionInclude.consumerProfile.include
      }),
      d.skillPluginOid ? getPluginSkillIds(d.skillPluginOid) : null,
      skillSelections ? getSelectedSkillIds(skillSelections) : null
    ]);
    let project = instance.project;

    let consumerAccess = await resolveConsumerProfileAccess({
      consumerProfile: fullConsumerProfile,
      organization: instance.organization,
      project,
      instance,
      context: d.context
    });

    return {
      scope: { project, instance },
      organization: instance.organization,
      consumerProfile: fullConsumerProfile,
      consumerGroups: consumerAccess.consumerGroups,
      accessTags: consumerAccess.accessTags,
      auditScope: consumerAccess.auditScope,
      allowedSkillIds: intersect(pluginSkillIds, selectedSkillIds),
      authorization: createResourceAuthorization({
        restricted: true,
        resourceActor: consumerAccess.resourceActor,
        accessTags: consumerAccess.accessTags,
        project,
        instance,
        consumerProfile: fullConsumerProfile
      })
    };
  });

  let resolveSkill = async (reference: string) => {
    let identifier = reference.trim();
    if (!identifier) {
      throw new ServiceError(badRequestError({ message: 'The skill argument is required' }));
    }

    let access = await getAccess();

    let skill = await skillService.getSkillById({
      ...access.scope,
      skillId: identifier,
      accessTags: access.accessTags
    });
    if (access.allowedSkillIds && !access.allowedSkillIds.has(skill.id)) {
      throw new ServiceError(notFoundError('skill', identifier));
    }

    return { access, skill };
  };

  return {
    instance,
    canCreateSkills:
      !d.skillPluginOid &&
      !skillSelections &&
      consumerProfile.surface.allowConsumerSkillAuthoring,
    getAccess,
    resolveSkill
  };
};
