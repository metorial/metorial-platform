export let consumerFileReadRoles = ['consumer#instance.file:read'] as const;
export let consumerFileWriteRoles = ['consumer#instance.file:write'] as const;
export let consumerFileLinkReadRoles = ['consumer#instance.file_link:read'] as const;
export let consumerFileLinkWriteRoles = ['consumer#instance.file_link:write'] as const;
export let consumerDocumentReadRoles = ['consumer#instance.document:read'] as const;
export let consumerDocumentWriteRoles = ['consumer#instance.document:write'] as const;
export let consumerStoreReadRoles = ['consumer#instance.store:read'] as const;
export let consumerAssistantReadRoles = ['consumer#instance.assistant:read'] as const;
export let consumerAssistantWriteRoles = ['consumer#instance.assistant:write'] as const;
export let consumerAssistantConversationReadRoles = [
  'consumer#instance.assistant.conversation:read'
] as const;
export let consumerAssistantConversationWriteRoles = [
  'consumer#instance.assistant.conversation:write'
] as const;
export let consumerSkillReadRoles = ['consumer#instance.skill:read'] as const;
export let consumerSkillWriteRoles = ['consumer#instance.skill:write'] as const;
export let consumerMagicMcpReadRoles = ['consumer#instance.magic_mcp:read'] as const;
export let consumerMagicMcpConnectRoles = ['consumer#instance.magic_mcp:connect'] as const;
export let consumerMagicMcpWriteRoles = ['consumer#instance.magic_mcp:write'] as const;
export let consumerProviderTemplateReadRoles = ['consumer#instance.provider_template:read'] as const;

export let consumerFileAccessRoles = [...consumerFileReadRoles, ...consumerFileWriteRoles] as const;
export let consumerFileLinkAccessRoles = [
  ...consumerFileLinkReadRoles,
  ...consumerFileLinkWriteRoles
] as const;
export let consumerDocumentAccessRoles = [
  ...consumerDocumentReadRoles,
  ...consumerDocumentWriteRoles
] as const;
export let consumerAssistantAccessRoles = [
  ...consumerAssistantReadRoles,
  ...consumerAssistantWriteRoles
] as const;
export let consumerAssistantConversationAccessRoles = [
  ...consumerAssistantConversationReadRoles,
  ...consumerAssistantConversationWriteRoles
] as const;
export let consumerSkillAccessRoles = [
  ...consumerSkillReadRoles,
  ...consumerSkillWriteRoles
] as const;
export let consumerMagicMcpAccessRoles = [
  ...consumerMagicMcpReadRoles,
  ...consumerMagicMcpConnectRoles,
  ...consumerMagicMcpWriteRoles
] as const;
