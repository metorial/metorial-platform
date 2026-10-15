import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePublishersGetOutput = {
  object: 'provider.publisher';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePublishersGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstancePublishersGetOutput>(
    ['image_url', 'created_at', 'updated_at'],
    1
  );
