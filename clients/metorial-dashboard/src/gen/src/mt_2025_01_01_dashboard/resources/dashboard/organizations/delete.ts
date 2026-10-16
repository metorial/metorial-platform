import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsDeleteOutput = {
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

export let mapDashboardOrganizationsDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsDeleteOutput>(
    ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at'],
    1
  );
