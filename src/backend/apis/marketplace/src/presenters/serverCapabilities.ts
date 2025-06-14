import { ServerCapabilities } from '@metorial/module-catalog';

export let serverCapabilitiesPresenter = (serverCapabilities: ServerCapabilities) => ({
  object: 'marketplace*server.capabilities',

  serverId: serverCapabilities.server.id,
  serverVariantId: serverCapabilities.serverVariant.id,
  serverVersionId: serverCapabilities.serverVersion?.id,

  prompts: serverCapabilities.prompts,
  tools: serverCapabilities.tools,
  resourceTemplates: serverCapabilities.resourceTemplates,
  capabilities: serverCapabilities.capabilities,
  info: serverCapabilities.info
});
