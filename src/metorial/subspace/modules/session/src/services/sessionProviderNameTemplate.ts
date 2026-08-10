import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Integration,
  type Provider,
  type SessionProvider,
  type Tenant
} from '@metorial-subspace/db';
import {
  buildBaseSessionProviderNameTemplate,
  buildFallbackSessionProviderNameTemplate
} from '../lib/sessionProviderNameTemplate';

type SessionProviderWithNameSource = SessionProvider & {
  provider: Pick<Provider, 'name'>;
  fromTemplateProvider?: {
    integrationInstanceProviderOid?: bigint | null;
    integrationInstanceGroupProviderOid?: bigint | null;
    integrationInstanceProvider?: {
      integration: Pick<
        Integration,
        'name' | 'useIntegrationNameForSessionProviderNameTemplatesOverride'
      >;
    } | null;
    integrationInstanceGroupProvider?: {
      integration: Pick<
        Integration,
        'name' | 'useIntegrationNameForSessionProviderNameTemplatesOverride'
      >;
    } | null;
  } | null;
};

let isUniqueConstraintError = (error: any) => error?.code === 'P2002';

let pickIntegrationNameSource = (provider: SessionProviderWithNameSource) =>
  provider.fromTemplateProvider?.integrationInstanceGroupProvider?.integration ??
  provider.fromTemplateProvider?.integrationInstanceProvider?.integration ??
  null;

let resolveIntegrationNameSource = async (
  provider: SessionProviderWithNameSource
): Promise<Pick<
  Integration,
  'name' | 'useIntegrationNameForSessionProviderNameTemplatesOverride'
> | null> => {
  let loaded = pickIntegrationNameSource(provider);
  if (loaded) return loaded;
  if (!provider.fromTemplateProviderOid) return null;

  let source = await db.sessionProvider.findFirst({
    where: {
      oid: provider.oid
    },
    select: {
      fromTemplateProvider: {
        select: {
          integrationInstanceProvider: {
            select: {
              integration: {
                select: {
                  name: true,
                  useIntegrationNameForSessionProviderNameTemplatesOverride: true
                }
              }
            }
          },
          integrationInstanceGroupProvider: {
            select: {
              integration: {
                select: {
                  name: true,
                  useIntegrationNameForSessionProviderNameTemplatesOverride: true
                }
              }
            }
          }
        }
      }
    }
  });

  return (
    source?.fromTemplateProvider?.integrationInstanceGroupProvider?.integration ??
    source?.fromTemplateProvider?.integrationInstanceProvider?.integration ??
    null
  );
};

let resolveNameTemplateSourceName = async (d: {
  tenant: Pick<Tenant, 'useIntegrationNamesForSessionProviderNameTemplates'>;
  provider: SessionProviderWithNameSource;
}) => {
  let integration = await resolveIntegrationNameSource(d.provider);
  if (!integration) return d.provider.provider.name;

  let useIntegrationName =
    integration.useIntegrationNameForSessionProviderNameTemplatesOverride ??
    d.tenant.useIntegrationNamesForSessionProviderNameTemplates;

  return useIntegrationName ? integration.name : d.provider.provider.name;
};

class sessionProviderNameTemplateServiceImpl {
  async ensureForSessionProvider<ProviderType extends SessionProviderWithNameSource>(d: {
    tenant: Pick<Tenant, 'useIntegrationNamesForSessionProviderNameTemplates'>;
    provider: ProviderType;
  }): Promise<ProviderType & { nameTemplate: string }> {
    let { provider } = d;

    if (provider.nameTemplate) {
      return provider as ProviderType & { nameTemplate: string };
    }

    let sourceName = await resolveNameTemplateSourceName(d);
    let templateCandidates = [
      buildBaseSessionProviderNameTemplate(sourceName),
      buildFallbackSessionProviderNameTemplate(sourceName, provider.tag),
      ...Array.from({ length: 5 }, () =>
        buildFallbackSessionProviderNameTemplate(sourceName, generatePlainId(4).toLowerCase())
      )
    ];

    for (let nameTemplate of templateCandidates) {
      try {
        let updated = await db.sessionProvider.updateMany({
          where: {
            oid: provider.oid,
            nameTemplate: null
          },
          data: {
            nameTemplate
          }
        });

        if (updated.count === 1) {
          return {
            ...provider,
            nameTemplate
          };
        }

        let current = await db.sessionProvider.findFirst({
          where: {
            oid: provider.oid
          },
          select: {
            nameTemplate: true
          }
        });

        if (current?.nameTemplate) {
          return {
            ...provider,
            nameTemplate: current.nameTemplate
          };
        }
      } catch (error: any) {
        if (isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(`Failed to initialize session provider name template: ${provider.id}`);
  }

  async ensureForSessionProviders<ProviderType extends SessionProviderWithNameSource>(d: {
    tenant: Pick<Tenant, 'useIntegrationNamesForSessionProviderNameTemplates'>;
    providers: ProviderType[];
  }): Promise<Array<ProviderType & { nameTemplate: string }>> {
    return await Promise.all(
      d.providers.map(provider =>
        this.ensureForSessionProvider({
          tenant: d.tenant,
          provider
        })
      )
    );
  }
}

export let sessionProviderNameTemplateService = Service.create(
  'sessionProviderNameTemplateService',
  () => new sessionProviderNameTemplateServiceImpl()
).build();
