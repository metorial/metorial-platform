import { generatePlainId } from '@mtsrc/id';
import { Service } from '@mtsrc/service';
import { db, type Provider, type SessionProvider } from '@metorial-subspace/db';
import {
  buildBaseSessionProviderNameTemplate,
  buildFallbackSessionProviderNameTemplate
} from '../lib/sessionProviderNameTemplate';

type SessionProviderWithNameSource = SessionProvider & {
  provider: Pick<Provider, 'name'>;
};

let isUniqueConstraintError = (error: any) => error?.code === 'P2002';

class sessionProviderNameTemplateServiceImpl {
  async ensureForSessionProvider<ProviderType extends SessionProviderWithNameSource>(
    provider: ProviderType
  ): Promise<ProviderType & { nameTemplate: string }> {
    if (provider.nameTemplate) {
      return provider as ProviderType & { nameTemplate: string };
    }

    let templateCandidates = [
      buildBaseSessionProviderNameTemplate(provider.provider.name),
      buildFallbackSessionProviderNameTemplate(provider.provider.name, provider.tag),
      ...Array.from({ length: 5 }, () =>
        buildFallbackSessionProviderNameTemplate(
          provider.provider.name,
          generatePlainId(4).toLowerCase()
        )
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

  async ensureForSessionProviders<ProviderType extends SessionProviderWithNameSource>(
    providers: ProviderType[]
  ): Promise<Array<ProviderType & { nameTemplate: string }>> {
    return await Promise.all(
      providers.map(provider => this.ensureForSessionProvider(provider))
    );
  }
}

export let sessionProviderNameTemplateService = Service.create(
  'sessionProviderNameTemplateService',
  () => new sessionProviderNameTemplateServiceImpl()
).build();
