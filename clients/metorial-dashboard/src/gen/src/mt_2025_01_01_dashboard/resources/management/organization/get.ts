import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationGetOutput = {
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

export let mapManagementOrganizationGetOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationGetOutput>(
    ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at'],
    1
  );
