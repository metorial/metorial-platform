import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsUpdateOutput = {
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

export let mapDashboardOrganizationsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsUpdateOutput>(
    ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsUpdateBody = {
  name?: string | undefined;
  imageFileId?: string | null | undefined;
  magicMcpOrigin?: string | null | undefined;
};

export let mapDashboardOrganizationsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsUpdateBody>([
    'image_file_id',
    'magic_mcp_origin'
  ]);
