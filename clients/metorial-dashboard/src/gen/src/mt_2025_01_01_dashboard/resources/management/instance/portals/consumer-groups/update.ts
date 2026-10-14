import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsConsumerGroupsUpdateOutput = {
  object: 'consumer.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} & { isManaged: boolean; isDefaultEveryoneGroup: boolean };

export let mapManagementInstancePortalsConsumerGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsConsumerGroupsUpdateOutput>(
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

export type ManagementInstancePortalsConsumerGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  isDefault?: boolean | undefined;
};

export let mapManagementInstancePortalsConsumerGroupsUpdateBody =
  /* @__PURE__ */ mapObject<ManagementInstancePortalsConsumerGroupsUpdateBody>([
    'is_default'
  ]);
