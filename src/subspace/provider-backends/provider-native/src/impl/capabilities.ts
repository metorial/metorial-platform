import {
  IProviderCapabilities,
  type ProviderSpecificationBehaviorParam,
  type ProviderSpecificationBehaviorRes,
  type ProviderSpecificationGetForPairParam,
  type ProviderSpecificationGetForProviderParam,
  type ProviderSpecificationGetRes
} from '@metorial-subspace/provider-utils';
import { getNativeIntegration } from '../registry';

let getNativeIdentifierFromProviderIdentifier = (identifier: string) => {
  let prefix = 'provider::native::';
  let suffix = '::provider';

  if (!identifier.startsWith(prefix) || !identifier.endsWith(suffix)) {
    throw new Error(`Invalid native provider identifier: ${identifier}`);
  }

  return identifier.slice(prefix.length, -suffix.length);
};

let mapIntegrationToSpecification = (
  integration: NonNullable<ReturnType<typeof getNativeIntegration>>
): ProviderSpecificationGetRes => ({
  status: 'success',
  type: 'full',
  features: {
    supportsAuthMethod: false,
    configContainsAuth: false
  },
  specification: {
    specId: `native::${integration.identifier}`,
    specUniqueIdentifier: integration.identifier,
    key: integration.identifier,
    name: integration.name,
    description: integration.description,
    metadata: {
      nativeIntegrationIdentifier: integration.identifier
    },
    configJsonSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    configVisibility: 'plain',
    mcp: null
  },
  triggers: [],
  authMethods: [],
  tools: integration.tools.map(tool => ({
    specId: `native::${integration.identifier}::tool::${tool.key}`,
    specUniqueIdentifier: `${integration.identifier}::${tool.key}`,
    callableId: tool.key,
    key: tool.key,
    name: tool.name,
    description: tool.description,
    inputJsonSchema: tool.inputJsonSchema,
    outputJsonSchema: tool.outputJsonSchema,
    constraints: tool.constraints,
    instructions: tool.instructions,
    capabilities: {},
    mcpToolType: {
      type: 'tool.callable'
    },
    tags: tool.tags,
    metadata: {
      ...tool.metadata,
      nativeIntegrationIdentifier: integration.identifier
    }
  }))
});

export class ProviderCapabilities extends IProviderCapabilities {
  override async getSpecificationBehavior(
    _data: ProviderSpecificationBehaviorParam
  ): Promise<ProviderSpecificationBehaviorRes> {
    return {
      supportsVersionSpecification: true,
      supportsDeploymentSpecification: true
    };
  }

  override async shouldDiscoverSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<{ shouldDiscover: boolean }> {
    return { shouldDiscover: false };
  }

  override async getSpecificationForProviderVersion(
    data: ProviderSpecificationGetForProviderParam
  ): Promise<ProviderSpecificationGetRes> {
    let integrationIdentifier = getNativeIdentifierFromProviderIdentifier(
      data.provider.identifier
    );
    let integration = getNativeIntegration(integrationIdentifier);
    if (!integration) {
      throw new Error(`Native integration not registered: ${integrationIdentifier}`);
    }

    return mapIntegrationToSpecification(integration);
  }

  override async getSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<ProviderSpecificationGetRes> {
    return this.getSpecificationForProviderVersion({
      tenant: data.tenant,
      provider: data.provider,
      providerVariant: data.providerVariant,
      providerVersion: data.providerVersion
    });
  }
}
