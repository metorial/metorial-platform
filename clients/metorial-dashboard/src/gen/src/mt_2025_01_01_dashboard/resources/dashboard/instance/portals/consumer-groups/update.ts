import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsConsumerGroupsUpdateOutput = {
  object: 'consumer.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} & { isManaged: boolean; isDefaultEveryoneGroup: boolean };

export let mapDashboardInstancePortalsConsumerGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsConsumerGroupsUpdateOutput>(
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

export type DashboardInstancePortalsConsumerGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  isDefault?: boolean | undefined;
};

export let mapDashboardInstancePortalsConsumerGroupsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstancePortalsConsumerGroupsUpdateBody>([
    'is_default'
  ]);
