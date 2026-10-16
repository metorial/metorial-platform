import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationUpdateOutput = {
  object: 'organization';
  id: string;
  type: 'default';
  slug: string;
  name: string;
  imageUrl: string;
  magicMcpOrigin: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationUpdateOutput>(
    ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationUpdateBody = {
  name?: string | undefined;
  imageFileId?: string | null | undefined;
};

export let mapManagementOrganizationUpdateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationUpdateBody>([
    'image_file_id'
  ]);
