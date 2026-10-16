import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpGroupsAddServersOutput = {
  object: 'magic_mcp.group';
  id: string;
  status: 'active' | 'deleted' | 'archived';
  slug: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpGroupsAddServersOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpGroupsAddServersOutput>(
    8
  );

export type ManagementInstanceMagicMcpGroupsAddServersBody = {
  magicMcpServerIds: string[];
};

export let mapManagementInstanceMagicMcpGroupsAddServersBody =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpGroupsAddServersBody>([
    'magic_mcp_server_ids'
  ]);
