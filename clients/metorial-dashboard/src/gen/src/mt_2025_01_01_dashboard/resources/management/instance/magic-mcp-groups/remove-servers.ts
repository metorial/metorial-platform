import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpGroupsRemoveServersOutput = {
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

export let mapManagementInstanceMagicMcpGroupsRemoveServersOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpGroupsRemoveServersOutput>(
    8
  );

export type ManagementInstanceMagicMcpGroupsRemoveServersBody = {
  magicMcpServerIds: string[];
};

export let mapManagementInstanceMagicMcpGroupsRemoveServersBody =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpGroupsRemoveServersBody>([
    'magic_mcp_server_ids'
  ]);
