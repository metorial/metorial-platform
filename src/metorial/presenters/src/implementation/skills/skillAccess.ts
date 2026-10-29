import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillAccessType } from '../../types';

export let v1SkillAccessPresenter = Presenter.create(skillAccessType)
  .presenter(async ({ skill, grants }) => ({
    object: 'skill.access',
    skill_id: skill.id,
    grants: grants.map(({ level, accessTag }) => {
      let consumerProfile =
        accessTag.consumerGroup?.personalOwner ?? accessTag.consumerProfile;
      let consumerGroup = accessTag.consumerGroup?.personalOwner
        ? null
        : accessTag.consumerGroup;

      return {
        object: 'skill.access_grant' as const,
        level,
        subject: {
          type: consumerProfile
            ? ('consumer_profile' as const)
            : consumerGroup
              ? ('consumer_group' as const)
              : ('access_tag' as const),
          consumer_profile_id: consumerProfile?.id ?? null,
          consumer_group_id: consumerGroup?.id ?? null,
          name: consumerProfile?.name ?? consumerGroup?.name ?? null
        }
      };
    })
  }))
  .schema(
    v.object({
      object: v.literal('skill.access', {
        description: "String representing the object's type"
      }),
      skill_id: v.string(),
      grants: v.array(
        v.object({
          object: v.literal('skill.access_grant'),
          level: v.enumOf(['read', 'write', 'manage']),
          subject: v.object({
            type: v.enumOf(['consumer_profile', 'consumer_group', 'access_tag']),
            consumer_profile_id: v.nullable(v.string()),
            consumer_group_id: v.nullable(v.string()),
            name: v.nullable(v.string())
          })
        })
      )
    })
  )
  .build();
