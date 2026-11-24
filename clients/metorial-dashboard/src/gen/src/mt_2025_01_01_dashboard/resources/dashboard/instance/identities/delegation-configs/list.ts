import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIdentitiesDelegationConfigsListOutput = {
  items: {
    object: 'identity.delegation_config';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    subDelegationBehavior: 'allow' | 'deny' | 'require_consent';
    subDelegationDepth: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIdentitiesDelegationConfigsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIdentitiesDelegationConfigsListOutput>(
    [
      7,
      [
        1,
        [
          'is_default',
          'sub_delegation_behavior',
          'sub_delegation_depth',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceIdentitiesDelegationConfigsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceIdentitiesDelegationConfigsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIdentitiesDelegationConfigsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
