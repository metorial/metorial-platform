import { mapObject } from '@metorial/util-resource-mapper/compact';

export type PublishersGetOutput = {
  object: 'provider.publisher';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPublishersGetOutput =
  /* @__PURE__ */ mapObject<PublishersGetOutput>(
    ['image_url', 'created_at', 'updated_at'],
    1
  );
