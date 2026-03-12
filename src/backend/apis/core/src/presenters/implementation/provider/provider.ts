import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerType } from '../../types';
import { v1ProviderTypePresenter } from './providerType';
import { v1ProviderVersionPresenter } from './providerVersion';
import { v1PublisherPresenter } from './publisher';

export let v1ProviderPresenter = Presenter.create(providerType)
  .presenter(async ({ provider }, opts) => ({
    object: 'provider' as const,
    id: provider.id,
    access: provider.access,
    status: provider.status,

    publisher: await v1PublisherPresenter
      .present({ publisher: provider.publisher }, opts)
      .run(),

    current_version: provider.currentVersion
      ? await v1ProviderVersionPresenter
          .present({ version: provider.currentVersion }, opts)
          .run()
      : null,

    oauth: provider.oauth
      ? {
          status: provider.oauth.status,
          callback_url: provider.oauth.callbackUrl,
          auto_registration:
            provider.oauth.autoRegistration?.status == 'supported'
              ? { status: 'supported' }
              : { status: 'unsupported' }
        }
      : null,

    name: provider.name,
    description: provider.description,
    slug: provider.slug,

    metadata: provider.metadata,

    created_at: provider.createdAt,
    updated_at: provider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider', { description: "String representing the object's type" }),
      id: v.string({
        name: 'id',
        description: 'Unique provider identifier',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      access: v.enumOf(['public', 'tenant'], {
        name: 'access',
        description: 'Access level of the provider'
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Current status of the provider'
      }),
      publisher: v1PublisherPresenter.schema,
      current_version: v.nullable(v1ProviderVersionPresenter.schema),
      oauth: v.nullable(
        v.object({
          status: v.enumOf(['enabled', 'disabled'], {
            name: 'status',
            description: 'OAuth status'
          }),
          callback_url: v.nullable(
            v.string({ name: 'callback_url', description: 'OAuth callback URL' })
          ),
          auto_registration: v.object({
            status: v.enumOf(['supported', 'unsupported'], {
              name: 'status',
              description: 'Auto-registration status'
            })
          })
        })
      ),
      identifier: v.string({ name: 'identifier', description: 'Provider identifier' }),
      name: v.string({ name: 'name', description: 'Display name of the provider' }),
      description: v.nullable(
        v.string({ name: 'description', description: 'Brief description of the provider' })
      ),
      slug: v.string({ name: 'slug', description: 'URL-friendly identifier' }),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
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

export let dashboardProviderPresenter = Presenter.create(providerType)
  .presenter(async (input, opts) => {
    let inner = await v1ProviderPresenter.present(input, opts).run();

    return {
      ...inner,
      type: await v1ProviderTypePresenter
        .present({ providerType: input.provider.type }, opts)
        .run(),
      tag: input.provider.tag
    };
  })
  .schema(
    v.intersection([
      v1ProviderPresenter.schema,
      v.object({
        type: v1ProviderTypePresenter.schema,
        tag: v.string({ name: 'tag', description: 'Provider tag' })
      })
    ])
  )
  .build();
