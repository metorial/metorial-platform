import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsAccessGetOutput = {
  object: 'skill.access';
  skillId: string;
  grants: {
    object: 'skill.access_grant';
    level: 'read' | 'write' | 'manage';
    subject: {
      type: 'consumer_profile' | 'consumer_group' | 'access_tag';
      consumerProfileId: string | null;
      consumerGroupId: string | null;
      name: string | null;
    };
  }[];
};

export let mapSkillsAccessGetOutput =
  /* @__PURE__ */ mapObject<SkillsAccessGetOutput>([
    'skill_id',
    [
      'grants',
      0,
      [
        2,
        [1, [['subject', 0, [1, ['consumer_profile_id', 'consumer_group_id']]]]]
      ]
    ]
  ]);
