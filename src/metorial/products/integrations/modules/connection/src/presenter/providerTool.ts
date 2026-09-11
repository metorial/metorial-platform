import type {
  ProviderTool,
  SessionProvider,
  SessionProviderInstance
} from '@metorial-subspace/db';

export let providerToolPresenter = (
  providerTool: ProviderTool & {
    sessionProvider: SessionProvider;
    sessionProviderInstance: SessionProviderInstance;
  }
) => ({
  object: 'provider.capabilities.tool',

  key: providerTool.key,

  sessionProvider: providerTool.sessionProvider.id,
  internalToolId: providerTool.id,

  name: providerTool.name,
  title: providerTool.value.title,
  description: providerTool.description,

  capabilities: providerTool.value.capabilities,
  constraints: providerTool.value.constraints,
  inputJsonSchema: providerTool.value.inputJsonSchema,
  instructions: providerTool.value.instructions,
  outputJsonSchema: providerTool.value.outputJsonSchema,
  tags: providerTool.value.tags,

  createdAt: providerTool.createdAt,
  updatedAt: providerTool.updatedAt
});
