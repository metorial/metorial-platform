import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationMembersListOutput = {
  items: {
    object: 'organization.member';
    id: string;
    status: 'active' | 'deleted';
    role: 'member' | 'admin';
    userId: string;
    organizationId: string;
    actorId: string;
    policies: {
      object: 'management.access_policy#preview';
      id: string;
      type: 'everyone' | 'admin' | 'custom';
      name: string;
      slug: string;
    }[];
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    actor: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationMembersListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationMembersListOutput>(
    [
      7,
      [
        1,
        [
          'user_id',
          'organization_id',
          'actor_id',
          'last_active_at',
          'created_at',
          'updated_at',
          'deleted_at',
          [
            'actor',
            0,
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
          ]
        ]
      ]
    ],
    1
  );

export type ManagementOrganizationMembersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { teamId?: string | string[] | undefined; search?: string | undefined };

export let mapManagementOrganizationMembersListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationMembersListQuery>([
    3,
    [[0, [1, ['team_id']]]]
  ]);
