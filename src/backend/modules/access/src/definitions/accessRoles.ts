export let consumerMagicMcpReadRoles = ['consumer#instance.magic_mcp:read'] as const;
export let consumerMagicMcpConnectRoles = ['consumer#instance.magic_mcp:connect'] as const;
export let consumerMagicMcpWriteRoles = ['consumer#instance.magic_mcp:write'] as const;
export let consumerProviderTemplateReadRoles = ['consumer#instance.provider_template:read'] as const;

export let consumerMagicMcpAccessRoles = [
  ...consumerMagicMcpReadRoles,
  ...consumerMagicMcpConnectRoles,
  ...consumerMagicMcpWriteRoles
] as const;
