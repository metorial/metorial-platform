import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePublishersGetOutput = {
  object: 'provider.publisher';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePublishersGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstancePublishersGetOutput>(
    ['image_url', 'created_at', 'updated_at'],
    1
  );
