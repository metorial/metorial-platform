import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsConsumerGroupsCreateOutput = {
  object: 'consumer.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} & { isManaged: boolean; isDefaultEveryoneGroup: boolean };

export let mapManagementInstancePortalsConsumerGroupsCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsConsumerGroupsCreateOutput>(
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

export type ManagementInstancePortalsConsumerGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  isDefault?: boolean | undefined;
};

export let mapManagementInstancePortalsConsumerGroupsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstancePortalsConsumerGroupsCreateBody>([
    'is_default'
  ]);
