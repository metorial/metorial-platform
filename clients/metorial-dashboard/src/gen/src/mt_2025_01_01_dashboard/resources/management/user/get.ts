import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementUserGetOutput = {
  object: 'user';
  id: string;
  status: 'active' | 'deleted';
  type: 'user' | 'consumer';
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementUserGetOutput =
  /* @__PURE__ */ mapObject<ManagementUserGetOutput>(
    ['first_name', 'last_name', 'image_url', 'created_at', 'updated_at'],
    1
  );
