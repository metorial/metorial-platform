import { delay } from '@lowerdeck/delay';
import { getSentry } from '@lowerdeck/sentry';
import { slugify } from '@lowerdeck/slugify';
import {
  providerInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { backend } from './backend';
import { listNativeIntegrations, setNativeIntegrationResyncHandler } from './registry';

let Sentry = getSentry();

let nativeProviderType = {
  name: 'Native',
  attributes: {
    provider: 'metorial-native' as const,
    backend: 'native' as const,
    triggers: { status: 'disabled' as const },
    auth: { status: 'disabled' as const },
    config: { status: 'disabled' as const }
  } satisfies PrismaJson.ProviderTypeAttributes
};

export let syncNativeIntegrations = async () => {
  let publisher = await publisherInternalService.upsertPublisherForMetorial();

  for (let integration of listNativeIntegrations()) {
    let provider = await providerInternalService.upsertProvider({
      owner: null,
      publisher,
      source: {
        type: 'native',
        integrationIdentifier: integration.identifier,
        backend
      },
      info: {
        name: integration.name,
        description: integration.description,
        slug: slugify(integration.identifier),
        globalIdentifier: integration.identifier,
        image: integration.logoUrl ? { type: 'url', url: integration.logoUrl } : null,
        readme: integration.readme
      },
      type: nativeProviderType
    });

    if (!provider.defaultVariant) {
      throw new Error(
        `No default variant after upserting native provider ${integration.identifier}`
      );
    }

    await providerVersionInternalService.upsertVersion({
      variant: provider.defaultVariant,
      isCurrent: true,
      source: {
        type: 'native',
        integrationIdentifier: integration.identifier,
        backend
      },
      info: {
        name: 'Current'
      },
      type: nativeProviderType
    });
  }
};

let bootstrapPromise: Promise<void> | null = null;

let ensureNativeIntegrationSync = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = syncNativeIntegrations().finally(() => {
      bootstrapPromise = null;
    });
  }

  await bootstrapPromise;
};

setNativeIntegrationResyncHandler(ensureNativeIntegrationSync);

(async () => {
  await delay(5000);
  await ensureNativeIntegrationSync();
})().catch(error => {
  console.error('Error syncing native integrations on startup:', error);
  Sentry.captureException(error);
});
