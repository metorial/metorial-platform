import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { Cases } from '@lowerdeck/case';
import { Hash } from '@lowerdeck/hash';
import { generateCode } from '@lowerdeck/id';
import { createQueue } from '@lowerdeck/queue';
import { slugify } from '@lowerdeck/slugify';
import { db, getId, snowflake } from '@metorial-subspace/db';
import {
  providerInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { canonicalizeAdapterCapabilities } from '../../adapterCapabilities';
import { backend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';

export let syncSlateVersionQueue = createQueue<{
  slateId: string;
  slateVersionId: string;
}>({
  name: 'sub/sltv/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

let getRegistries = createLocallyCachedFunction({
  getHash: (id: string) => id,
  ttlSeconds: 60,
  provider: async id => slates.registry.get({ registryId: id })
});

let generatePrettySlug = (fullIdentifier: string) => {
  let withoutAt = fullIdentifier.startsWith('@') ? fullIdentifier.slice(1) : fullIdentifier;
  let slashIndex = withoutAt.indexOf('/');
  if (slashIndex === -1) return slugify(withoutAt);

  let workspace = withoutAt.slice(0, slashIndex);
  let name = withoutAt.slice(slashIndex + 1);

  if (workspace === 'metorial') return slugify(name);
  if (name.startsWith(workspace)) return slugify(name);
  return slugify(`${workspace}-${name}`);
};

let metorialDomains = [
  '.slates.dev',
  '.metorial.com',
  '.metorial.dev',
  '.metorial.net',
  '.metorial.app',
  '.metorial.cloud',
  '.metorial.io',
  '.metorial.ai',
  '.metorial-enterprise.com',
  'localhost'
];

let normalizeDocs = (docs: unknown): PrismaJson.ProviderListingDocReference[] => {
  if (!Array.isArray(docs)) return [];

  return docs
    .filter(
      (doc): doc is { name: string; url: string; type?: string } =>
        !!doc &&
        typeof doc === 'object' &&
        typeof (doc as any).name === 'string' &&
        typeof (doc as any).url === 'string'
    )
    .map(doc => ({
      ...(typeof doc.type === 'string' ? { type: doc.type } : {}),
      name: doc.name,
      url: doc.url
    }));
};

let buildProviderListingDocs = (spec: any): PrismaJson.ProviderListingDocs | undefined => {
  if (!spec) return undefined;

  let providerDocs = normalizeDocs(spec.providerDocs);
  let configDocs = normalizeDocs(spec.configSchemaDocs);
  let authMethods = (spec.authMethods ?? [])
    .map((authMethod: any) => ({
      key: authMethod.key,
      name: authMethod.name,
      type: authMethod.type,
      docs: normalizeDocs(authMethod.docs)
    }))
    .filter((authMethod: any) => authMethod.docs.length > 0);
  let actions = [...(spec.tools ?? []), ...(spec.triggers ?? [])]
    .filter((action: any) => !action.adapter && !action.isPublic)
    .map((action: any) => ({
      key: action.key,
      name: action.name,
      type: action.type,
      docs: normalizeDocs(action.docs)
    }))
    .filter((action: any) => action.docs.length > 0);

  let hasDocs =
    providerDocs.length > 0 ||
    configDocs.length > 0 ||
    authMethods.length > 0 ||
    actions.length > 0;
  if (!hasDocs) return undefined;

  return {
    provider: providerDocs,
    config: configDocs,
    authMethods,
    actions
  };
};

type SlatesAdapter = {
  identifier: string;
  slateIdentifier: string;
  name: string;
  capabilities: { id: string; value: any }[];
};

let syncProviderAdapters = async (d: { providerOid: bigint; adapters: SlatesAdapter[] }) =>
  await db.$transaction(async tx => {
    let adapterBySlateIdentifier = new Map<string, { oid: bigint }>();

    for (let adapter of d.adapters) {
      let global = await tx.providerAdapterGlobal.upsert({
        where: { identifier: adapter.identifier },
        create: {
          ...getId('providerAdapterGlobal'),
          identifier: adapter.identifier,
          name: adapter.name
        },
        update: { name: adapter.name }
      });

      let providerAdapter = await tx.providerAdapter.upsert({
        where: {
          providerOid_globalOid: {
            providerOid: d.providerOid,
            globalOid: global.oid
          }
        },
        create: {
          ...getId('providerAdapter'),
          identifier: adapter.slateIdentifier,
          providerOid: d.providerOid,
          globalOid: global.oid
        },
        update: { identifier: adapter.slateIdentifier }
      });

      for (let capability of canonicalizeAdapterCapabilities(adapter.capabilities)) {
        await tx.providerAdapterCapability.upsert({
          where: {
            adapterOid_identifier: {
              adapterOid: providerAdapter.oid,
              identifier: capability.id
            }
          },
          create: {
            ...getId('providerAdapterCapability'),
            adapterOid: providerAdapter.oid,
            identifier: capability.id
          },
          update: {}
        });
      }

      adapterBySlateIdentifier.set(adapter.slateIdentifier, providerAdapter);
    }

    return adapterBySlateIdentifier;
  });

let syncProviderVersionAdapters = async (d: {
  providerVersionOid: bigint;
  adapters: SlatesAdapter[];
  adapterBySlateIdentifier: Map<string, { oid: bigint }>;
}) =>
  await db.$transaction(async tx => {
    let desiredAdapterOids = d.adapters.flatMap(adapter => {
      let record = d.adapterBySlateIdentifier.get(adapter.slateIdentifier);
      return record ? [record.oid] : [];
    });

    await tx.providerVersionAdapter.deleteMany({
      where: {
        providerVersionOid: d.providerVersionOid,
        adapterOid: { notIn: desiredAdapterOids }
      }
    });

    for (let adapter of d.adapters) {
      let providerAdapter = d.adapterBySlateIdentifier.get(adapter.slateIdentifier);
      if (!providerAdapter) {
        throw new Error(`Provider adapter not found: ${adapter.slateIdentifier}`);
      }

      let capabilities = canonicalizeAdapterCapabilities(adapter.capabilities);
      let versionAdapter = await tx.providerVersionAdapter.upsert({
        where: {
          providerVersionOid_adapterOid: {
            providerVersionOid: d.providerVersionOid,
            adapterOid: providerAdapter.oid
          }
        },
        create: {
          ...getId('providerVersionAdapter'),
          providerVersionOid: d.providerVersionOid,
          adapterOid: providerAdapter.oid,
          capabilities
        },
        update: { capabilities }
      });

      let capabilityRecords = await tx.providerAdapterCapability.findMany({
        where: { adapterOid: providerAdapter.oid },
        select: { oid: true, identifier: true }
      });
      let capabilityByIdentifier = new Map(
        capabilityRecords.map(capability => [capability.identifier, capability])
      );

      await tx.providerVersionAdapterCapability.deleteMany({
        where: { providerVersionAdapterOid: versionAdapter.oid }
      });
      if (capabilities.length > 0) {
        await tx.providerVersionAdapterCapability.createMany({
          data: capabilities.map(capability => {
            let definition = capabilityByIdentifier.get(capability.id);
            if (!definition) {
              throw new Error(
                `Provider adapter capability not found: ${adapter.slateIdentifier}/${capability.id}`
              );
            }
            return {
              ...getId('providerVersionAdapterCapability'),
              providerVersionAdapterOid: versionAdapter.oid,
              adapterCapabilityOid: definition.oid,
              value: capability.value
            };
          })
        });
      }
    }
  });

export let syncSlateVersionQueueProcessor = syncSlateVersionQueue.process(async data => {
  let version = await slates.slateVersion.get({
    slateId: data.slateId,
    slateVersionId: data.slateVersionId
  });
  if (version.status !== 'active') return;

  let slate = await slates.slate.get({
    slateId: data.slateId
  });

  let registry = await getRegistries(slate.registryId);
  let parsedUrl = new URL(registry.url);
  let isMetorialRegistry = metorialDomains.some(domain => parsedUrl.hostname.endsWith(domain));

  let registryRecord: Awaited<ReturnType<typeof slates.slate.getRegistryRecord>>;
  let registryVersionRecord: Awaited<ReturnType<typeof slates.slateVersion.getRegistryRecord>>;

  try {
    registryRecord = await slates.slate.getRegistryRecord({
      slateId: slate.id
    });
    registryVersionRecord = await slates.slateVersion.getRegistryRecord({
      slateId: slate.id,
      slateVersionId: version.id
    });
  } catch (error) {
    console.warn(
      `Skipping subspace sync for ${slate.id} (${version.id}): registry record unavailable`,
      error
    );
    return;
  }

  let slateRecord = await db.slate.upsert({
    where: { id: slate.id },
    create: {
      oid: snowflake.nextId(),
      id: slate.id,
      identifier: slate.identifier,
      registryUrl: registry.url,
      identifierInRegistry: registryRecord.fullIdentifier
    },
    update: {}
  });

  let newVersionOid = snowflake.nextId();
  let slateVersionRecord = await db.slateVersion.upsert({
    where: { id: version.id },
    create: {
      oid: newVersionOid,
      id: version.id,
      version: version.version,
      identifier: `${slate.identifier}::${version.version}`,
      slateOid: slateRecord.oid
    },
    update: {}
  });

  let readmeNames = ['readme.md'];
  let readme = registryVersionRecord.documents.find((d: any) =>
    readmeNames.some(n => d.path.toLocaleLowerCase().endsWith(n))
  )?.content;

  let publisher = isMetorialRegistry
    ? await publisherInternalService.upsertPublisherForMetorial()
    : await publisherInternalService.upsertPublisherForExternal({
        identifier: `slates::${slate.registryId}::${slate.scope.id}`,
        name: registryRecord.name,
        description: registryRecord.description ?? undefined
      });

  let spec = version.specification?.id
    ? await slates.slateSpecification.get({
        slateSpecificationId: version.specification?.specificationId
      })
    : null;

  let hasConfig = !!(spec ? normalizeJsonSchema(spec.configSchema) : null);
  let hasAuthConfig = !!(spec && spec.authMethods.length > 0);
  let hasOAuth = spec?.authMethods.some(am => am.type === 'oauth');
  let hasTriggers = !!(spec ? spec.triggers.some(trigger => !trigger.adapter) : false);
  let docs = buildProviderListingDocs(spec);

  let type = {
    name: 'Slates',

    attributes: {
      provider: 'metorial-slates',
      backend: 'slates',

      triggers: hasTriggers
        ? {
            status: 'enabled',
            receiverUrl: `${env.service.SLATES_HUB_PUBLIC_URL}/slates-hub/triggers/webhook/{callback.slatesTriggerId}`
          }
        : { status: 'disabled' },

      auth: hasAuthConfig
        ? {
            status: 'enabled',

            oauth: hasOAuth
              ? {
                  status: 'enabled',
                  oauthCallbackUrl: `${env.service.SLATES_HUB_PUBLIC_URL}/slates-hub/callback`
                }
              : { status: 'disabled' },

            export: { status: 'enabled' },

            import: { status: 'enabled' }
          }
        : { status: 'disabled' },

      config: hasConfig
        ? { status: 'enabled', read: { status: 'enabled' } }
        : { status: 'disabled' }
    } satisfies PrismaJson.ProviderTypeAttributes
  };

  let provider = await providerInternalService.upsertProvider({
    owner: null,
    publisher,
    source: {
      type: 'slates',
      slate: slateRecord,
      backend
    },
    info: await (async () => {
      let regIdentifier = registryRecord.fullIdentifier as string;
      let slug = slugify(`${regIdentifier}-${generateCode(5)}`);
      let globalIdentifier = slugify(
        `${regIdentifier}-${(await Hash.sha256(JSON.stringify(['slate', regIdentifier, registry.url]))).slice(0, 6)}`
      );
      let prettySlug = generatePrettySlug(regIdentifier);
      let aliases = [slug, globalIdentifier, prettySlug, regIdentifier];

      return {
        name: Cases.toTitleCase(slate.name),
        description: slate.description ?? undefined,
        slug,
        prettySlug,
        aliases,
        image: registryRecord.logoUrl ? { type: 'url', url: registryRecord.logoUrl } : null,
        skills: registryRecord.skills,
        readme: readme,
        docs,
        categories: registryRecord.categories?.map((c: any) => c.identifier) ?? [],
        globalIdentifier
      };
    })(),
    type
  });
  if (!provider?.defaultVariant) {
    throw new Error(`No default variant after upserting provider for slate ${slate.id}`);
  }

  // Abort if the version already existed
  // if (slateVersionRecord.oid !== newVersionOid) return;

  let adapters = (version.adapters ?? []) as SlatesAdapter[];
  let adapterBySlateIdentifier = await syncProviderAdapters({
    providerOid: provider.oid,
    adapters
  });

  let providerVersion = await providerVersionInternalService.upsertVersion({
    variant: provider.defaultVariant,
    isCurrent: version.isCurrent,
    source: {
      type: 'slates',
      slate: slateRecord,
      slateVersion: slateVersionRecord,
      backend
    },
    info: {
      name: `v${version.version}`
    },
    type
  });

  await syncProviderVersionAdapters({
    providerVersionOid: providerVersion.oid,
    adapters,
    adapterBySlateIdentifier
  });
});
