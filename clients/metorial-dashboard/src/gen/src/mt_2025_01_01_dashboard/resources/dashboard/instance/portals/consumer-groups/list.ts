import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsConsumerGroupsListOutput = {
  items: ({
    object: 'consumer.group';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  } & { isManaged: boolean; isDefaultEveryoneGroup: boolean })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePortalsConsumerGroupsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsConsumerGroupsListOutput>(
    [
      7,
      [
        3,
        [
          [
            0,
            [
              1,
              [
                'is_default',
                'created_at',
                'updated_at',
                'is_managed',
                'is_default_everyone_group'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstancePortalsConsumerGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  search?: string | undefined;
};

export let mapDashboardInstancePortalsConsumerGroupsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsConsumerGroupsListQuery>(
    0
  );
