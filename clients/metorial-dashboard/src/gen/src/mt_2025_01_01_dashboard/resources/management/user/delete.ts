import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementUserDeleteOutput = {
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

export let mapManagementUserDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementUserDeleteOutput>(
    ['first_name', 'last_name', 'image_url', 'created_at', 'updated_at'],
    1
  );

export type ManagementUserDeleteBody = {
  name?: string | undefined;
  email?: string | undefined;
};

export let mapManagementUserDeleteBody =
  /* @__PURE__ */ createMapper<ManagementUserDeleteBody>(0);
