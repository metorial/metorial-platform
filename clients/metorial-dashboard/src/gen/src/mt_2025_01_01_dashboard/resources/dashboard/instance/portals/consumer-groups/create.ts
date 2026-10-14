import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsConsumerGroupsCreateOutput = {
  object: 'consumer.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} & { isManaged: boolean; isDefaultEveryoneGroup: boolean };

export let mapDashboardInstancePortalsConsumerGroupsCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsConsumerGroupsCreateOutput>(
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
    ],
    1
  );

export type DashboardInstancePortalsConsumerGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  isDefault?: boolean | undefined;
};

export let mapDashboardInstancePortalsConsumerGroupsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstancePortalsConsumerGroupsCreateBody>([
    'is_default'
  ]);
