import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceStoresListOutput = {
  items: {
    object: 'store';
    id: string;
    name: string;
    access: 'private' | 'public_read' | 'public_write';
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceStoresListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceStoresListOutput>(
    [7, [1, ['item_count', 'created_at', 'updated_at']]],
    1
  );

export type DashboardInstanceStoresListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceStoresListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceStoresListQuery>([
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
  ]);
