import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationSandboxesCreateOutput = {
  object: 'organization.sandbox';
  id: string;
  name: string;
  organizationId: string;
  instance: {
    object: 'organization.instance';
    id: string;
    slug: string;
    name: string;
    organizationId: string;
    sandboxId: string | null;
    type: 'development' | 'production';
    createdAt: Date;
    updatedAt: Date;
    project: {
      object: 'organization.project';
      id: string;
      status: 'active' | 'deleted';
      slug: string;
      name: string;
      organizationId: string;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  creatorActor: {
    object: 'organization.actor';
    id: string;
    type: 'member' | 'machine_access';
    organizationId: string;
    name: string;
    email: string | null;
    imageUrl: string;
    member: {
      object: 'organization.member#preview';
      id: string;
      status: 'active' | 'deleted';
      role: 'member' | 'admin';
    } | null;
    teams: {
      id: string;
      name: string;
      slug: string;
      assignmentId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationSandboxesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationSandboxesCreateOutput>(
    [
      'organization_id',
      [
        'instance',
        0,
        [
          1,
          [
            'organization_id',
            'sandbox_id',
            'created_at',
            'updated_at',
            ['project', 0, [1, ['organization_id', 'created_at', 'updated_at']]]
          ]
        ]
      ],
      [
        'creator_actor',
        1,
        [
          1,
          [
            'organization_id',
            'image_url',
            [
              'teams',
              0,
              [2, [1, ['assignment_id', 'created_at', 'updated_at']]]
            ],
            'created_at',
            'updated_at'
          ]
        ]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementOrganizationSandboxesCreateBody = {
  name: string;
  projectId: string;
};

export let mapManagementOrganizationSandboxesCreateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationSandboxesCreateBody>([
    'project_id'
  ]);
