import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsGroupsUpdateOutput = {
  object: 'skill.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  allowConsumerSkillAssignment: boolean;
  skills: {
    object: 'skill';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string;
    clientName: string;
    clientDescription: string | null;
    clientMetadata: Record<string, any> | null;
    license: string | null;
    compatibility: string | null;
    metadata: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSkillsGroupsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsGroupsUpdateOutput>(
    [
      'allow_consumer_skill_assignment',
      [
        'skills',
        0,
        [
          2,
          [
            1,
            [
              'image_url',
              'client_name',
              'client_description',
              'client_metadata',
              'created_at',
              'updated_at'
            ]
          ]
        ]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceSkillsGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, any> | null | undefined;
  skillIds?: string[] | undefined;
  allowConsumerSkillAssignment?: boolean | undefined;
};

export let mapDashboardInstanceSkillsGroupsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsGroupsUpdateBody>([
    'skill_ids',
    'allow_consumer_skill_assignment'
  ]);
