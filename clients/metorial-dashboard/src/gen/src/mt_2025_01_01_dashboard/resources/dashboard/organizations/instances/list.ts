import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsInstancesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsInstancesListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsInstancesListOutput>(
    [
      7,
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
    1
  );

export type DashboardOrganizationsInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  projectId?: string | string[] | undefined;
  type?: 'prod' | 'dev' | 'production' | 'development' | undefined;
};

export let mapDashboardOrganizationsInstancesListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsInstancesListQuery>([
    3,
    [[0, [1, ['project_id']]]]
  ]);
