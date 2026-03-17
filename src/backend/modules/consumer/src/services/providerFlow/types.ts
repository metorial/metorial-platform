import type { PaginatorInput } from '@lowerdeck/pagination';
import type { Instance, Prisma, ProviderTemplate } from '@metorial/db';
import {
  subspaceProviderAuthMethodService,
  subspaceProviderConfigService,
  subspaceProviderDeploymentService,
  subspaceProviderService
} from '@metorial/module-subspace';

export type ConsumerProviderAvailability = 'available_now' | 'request_access';

export type ConsumerProviderAuthMethodList = Awaited<
  ReturnType<Awaited<ReturnType<typeof subspaceProviderAuthMethodService.list>>['run']>
>['items'];

export type ConsumerProviderProvisionResource = {
  id: string;
};

export type ConsumerCatalogListInput = PaginatorInput;
export type ConsumerCatalogPageDirection = 'after' | 'before';

export type ConsumerCatalogBoundary = {
  id: string;
  name: string;
};

export let magicMcpCatalogInclude = {
  aliases: true,
  subspaceSession: true
} as const;

export type ConsumerMagicMcpCatalogServer = Prisma.MagicMcpServerGetPayload<{
  include: typeof magicMcpCatalogInclude;
}>;

export type ConsumerProviderCatalogEntry =
  | {
      type: 'provider_template';
      availability: ConsumerProviderAvailability;
      providerTemplate: ProviderTemplate;
      deployment: Awaited<ReturnType<typeof subspaceProviderDeploymentService.get>>;
      provider: Awaited<ReturnType<typeof subspaceProviderService.get>>;
      configSchema?: Awaited<ReturnType<typeof subspaceProviderConfigService.getConfigSchema>> | null;
      authMethods?: ConsumerProviderAuthMethodList;
    }
  | {
      type: 'magic_mcp_server';
      availability: ConsumerProviderAvailability;
      magicMcpServer: ConsumerMagicMcpCatalogServer;
    };

export type ConsumerProviderTemplateCatalogEntry = Extract<
  ConsumerProviderCatalogEntry,
  {
    type: 'provider_template';
  }
>;

export type ConsumerProviderTemplateContext = {
  instance: Instance;
  providerTemplate: ProviderTemplate;
  deployment: Awaited<ReturnType<typeof subspaceProviderDeploymentService.get>>;
  provider: Awaited<ReturnType<typeof subspaceProviderService.get>>;
  authMethods: ConsumerProviderAuthMethodList;
  configSchema: Awaited<ReturnType<typeof subspaceProviderConfigService.getConfigSchema>> | null;
};
