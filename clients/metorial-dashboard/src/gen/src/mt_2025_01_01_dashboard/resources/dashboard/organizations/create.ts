import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsCreateOutput = {
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

export let mapDashboardOrganizationsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsCreateOutput>(
    ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsCreateBody = { name: string };

export let mapDashboardOrganizationsCreateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsCreateBody>(0);
