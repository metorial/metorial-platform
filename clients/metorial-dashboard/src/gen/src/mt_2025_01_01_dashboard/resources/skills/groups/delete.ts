import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsGroupsDeleteOutput = {
  object: 'skill.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  imageUrl: string;
  image: {
    object: 'skill.image';
    type: 'file' | 'url' | 'icon' | 'default';
    icon: string | null;
    color: string | null;
  };
  allowConsumerSkillAssignment: boolean;
  skills: {
    object: 'skill';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string;
    image: {
      object: 'skill.image';
      type: 'file' | 'url' | 'icon' | 'default';
      icon: string | null;
      color: string | null;
    };
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

export let mapSkillsGroupsDeleteOutput =
  /* @__PURE__ */ mapObject<SkillsGroupsDeleteOutput>(
    [
      'image_url',
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
