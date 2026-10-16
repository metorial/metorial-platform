import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementUserUpdateOutput = {
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

export let mapManagementUserUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementUserUpdateOutput>(
    ['first_name', 'last_name', 'image_url', 'created_at', 'updated_at'],
    1
  );

export type ManagementUserUpdateBody = {
  name?: string | undefined;
  email?: string | undefined;
};

export let mapManagementUserUpdateBody =
  /* @__PURE__ */ createMapper<ManagementUserUpdateBody>(0);
