import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsConsumerGroupsListOutput = {
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

export let mapPortalsConsumerGroupsListOutput =
  /* @__PURE__ */ createMapper<PortalsConsumerGroupsListOutput>(
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

export type PortalsConsumerGroupsListQuery = {
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

export let mapPortalsConsumerGroupsListQuery =
  /* @__PURE__ */ createMapper<PortalsConsumerGroupsListQuery>(0);
