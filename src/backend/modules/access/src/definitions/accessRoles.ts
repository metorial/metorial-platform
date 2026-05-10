export let consumerAssistantReadRoles = ['consumer#instance.assistant:read'] as const;
export let consumerAssistantWriteRoles = ['consumer#instance.assistant:write'] as const;
export let consumerAssistantConversationReadRoles = [
  'consumer#instance.assistant.conversation:read'
] as const;
export let consumerAssistantConversationWriteRoles = [
  'consumer#instance.assistant.conversation:write'
] as const;
export let consumerMagicMcpReadRoles = ['consumer#instance.magic_mcp:read'] as const;
export let consumerMagicMcpConnectRoles = ['consumer#instance.magic_mcp:connect'] as const;
export let consumerMagicMcpWriteRoles = ['consumer#instance.magic_mcp:write'] as const;
export let consumerProviderTemplateReadRoles = ['consumer#instance.provider_template:read'] as const;

export let consumerAssistantAccessRoles = [
  ...consumerAssistantReadRoles,
  ...consumerAssistantWriteRoles
] as const;
export let consumerAssistantConversationAccessRoles = [
  ...consumerAssistantConversationReadRoles,
  ...consumerAssistantConversationWriteRoles
] as const;
export let consumerMagicMcpAccessRoles = [
  ...consumerMagicMcpReadRoles,
  ...consumerMagicMcpConnectRoles,
  ...consumerMagicMcpWriteRoles
] as const;
