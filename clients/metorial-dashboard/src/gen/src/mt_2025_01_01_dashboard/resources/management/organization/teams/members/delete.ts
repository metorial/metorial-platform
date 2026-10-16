import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationTeamsMembersDeleteOutput = {
  object: 'management.team';
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  policies: {
    object: 'management.access_policy#preview';
    id: string;
    type: 'everyone' | 'admin' | 'custom';
    name: string;
    slug: string;
  }[];
  projects: {
    id: string;
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
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationTeamsMembersDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationTeamsMembersDeleteOutput>(
    [
      'organization_id',
      [
        'projects',
        0,
        [
          2,
          [
            1,
            [
              'created_at',
              'updated_at',
              [
                'project',
                0,
                [1, ['organization_id', 'created_at', 'updated_at']]
              ]
            ]
          ]
        ]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );
