import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { providerListingType } from '../../../types';
import { v1ProviderListingCategoryPresenter } from './category';
import { v1ProviderListingCollectionPresenter } from './collection';
import { v1ProviderListingGroupPresenter } from './group';
import { dashboardProviderPresenter, v1ProviderPresenter } from './provider';

let providerListingDocReferenceSchema = v.object({
  type: v.optional(v.string({ description: 'The protocol-specific documentation type.' })),
  name: v.string({ description: 'The display name for this documentation reference.' }),
  url: v.string({ description: 'The documentation URL.' })
});

let providerListingDocsSchema = v.nullable(
  v.object({
    provider: v.array(providerListingDocReferenceSchema),
    config: v.array(providerListingDocReferenceSchema),
    auth_methods: v.array(
      v.object({
        key: v.string(),
        name: v.string(),
        type: v.string(),
        docs: v.array(providerListingDocReferenceSchema)
      })
    ),
    actions: v.array(
      v.object({
        key: v.string(),
        name: v.string(),
        type: v.enumOf(['tool', 'trigger']),
        docs: v.array(providerListingDocReferenceSchema)
      })
    )
  })
);

let presentProviderListingDocs = (docs: any) => {
  if (!docs) return null;

  return {
    provider: docs.provider ?? [],
    config: docs.config ?? [],
    auth_methods: (docs.authMethods ?? []).map((authMethod: any) => ({
      key: authMethod.key,
      name: authMethod.name,
      type: authMethod.type,
      docs: authMethod.docs ?? []
    })),
    actions: (docs.actions ?? []).map((action: any) => ({
      key: action.key,
      name: action.name,
      type: action.type,
      docs: action.docs ?? []
    }))
  };
};

export let v1ProviderListingPresenter = Presenter.create(providerListingType)
  .presenter(async ({ providerListing, tenant }, opts) => {
    return {
      object: 'provider.listing' as const,
      id: providerListing.id,

      attributes: {
        is_public: providerListing.isPublic,
        is_customized: providerListing.isCustomized,
        is_metorial: providerListing.isMetorial,
        is_verified: providerListing.isVerified,
        is_official: providerListing.isOfficial

        // deployments_count: providerListing.deploymentsCount,
        // provider_sessions_count: providerListing.providerSessionsCount,
        // provider_messages_count: providerListing.providerMessagesCount,
        // rank: providerListing.rank,
      },

      name: providerListing.name,
      description: providerListing.description,
      slug: providerListing.prettySlug ?? providerListing.slug,

      image_url: await getImageUrl(providerListing),

      readme:
        (providerListing as typeof providerListing & { readme?: string | null }).readme ??
        null,
      skills: providerListing.skills,

      provider: await v1ProviderPresenter
        .present({ provider: providerListing.provider, tenant }, opts)
        .run(),

      categories: await Promise.all(
        providerListing.categories.map(c =>
          v1ProviderListingCategoryPresenter.present({ category: c }, opts).run()
        )
      ),

      collections: await Promise.all(
        providerListing.collections.map(c =>
          v1ProviderListingCollectionPresenter.present({ collection: c }, opts).run()
        )
      ),

      groups: await Promise.all(
        providerListing.groups.map(g =>
          v1ProviderListingGroupPresenter.present({ group: g }, opts).run()
        )
      ),

      created_at: providerListing.createdAt,
      updated_at: providerListing.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.listing', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique listing identifier',
        examples: ['plg_8kLmNpQrStUvWxYz']
      }),
      attributes: v.object(
        {
          is_public: v.boolean({ name: 'is_public', description: 'Whether publicly visible' }),
          is_customized: v.boolean({
            name: 'is_customized',
            description: 'Whether has custom config'
          }),
          is_metorial: v.boolean({
            name: 'is_metorial',
            description: 'Whether Metorial-maintained'
          }),
          is_verified: v.boolean({ name: 'is_verified', description: 'Whether verified' }),
          is_official: v.boolean({
            name: 'is_official',
            description: 'Whether official integration'
          })
        },
        { name: 'attributes', description: 'Listing attribute flags' }
      ),
      name: v.string({ name: 'name', description: 'Display name', examples: ['GitHub'] }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Full description',
          examples: ['Connect to GitHub repositories, issues, and pull requests']
        })
      ),
      slug: v.string({
        name: 'slug',
        description: 'URL-friendly identifier',
        examples: ['github']
      }),
      image_url: v.string({
        name: 'image_url',
        description: 'URL of the listing logo/icon',
        examples: ['https://cdn.metorial.com/images/github.png']
      }),
      readme: v.nullable(
        v.string({
          name: 'readme',
          description: 'README content in markdown',
          examples: ['# GitHub\n\nConnect to GitHub repositories, issues, and pull requests.']
        })
      ),
      skills: v.array(v.string(), {
        name: 'skills',
        description: 'Capability tags',
        examples: [['code-review', 'pull-requests']]
      }),
      provider: v1ProviderPresenter.schema,
      categories: v.array(v1ProviderListingCategoryPresenter.schema, {
        name: 'categories',
        description: 'Provider categories for organization and filtering'
      }),
      collections: v.array(v1ProviderListingCollectionPresenter.schema, {
        name: 'collections',
        description: 'Provider collections this provider belongs to'
      }),
      groups: v.array(v1ProviderListingGroupPresenter.schema, {
        name: 'groups',
        description: 'User groups with access to this provider'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

export let dashboardProviderListingPresenter = Presenter.create(providerListingType)
  .presenter(async (input, opts) => {
    let inner = await v1ProviderListingPresenter.present(input, opts).run();

    return {
      ...inner,
      docs: presentProviderListingDocs((input.providerListing as any).docs),
      provider: await dashboardProviderPresenter
        .present(
          {
            provider: input.providerListing.provider,
            tenant: input.tenant
          },
          opts
        )
        .run()
    };
  })
  .schema(
    v.intersection([
      v1ProviderListingPresenter.schema,
      v.object({
        docs: providerListingDocsSchema,
        provider: dashboardProviderPresenter.schema
      })
    ])
  )
  .build();
