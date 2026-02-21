import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
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

    type: await v1ProviderTypePresenter.present({ providerType: provider.type }, opts).run(),

    oauth: provider.oauth
      ? {
          status: provider.oauth.status,
          callback_url: provider.oauth.callbackUrl,
          auto_registration: provider.oauth.autoRegistration
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
      access: v.string({
        name: 'access',
        description: 'Access level of the provider',
        examples: ['public', 'tenant']
      }),
      status: v.string({
        name: 'status',
        description: 'Current status of the provider',
        examples: ['active', 'archived']
      }),
      owner_tenant: v.nullable(
        v.object({
          object: v.string({ name: 'object', description: 'Object type' }),
          id: v.string({ name: 'id', description: 'Tenant identifier' }),
          identifier: v.string({
            name: 'identifier',
            description: 'Tenant identifier string'
          }),
          name: v.string({ name: 'name', description: 'Tenant name' }),
          created_at: v.date({ name: 'created_at', description: 'Timestamp when created' })
        })
      ),
      publisher: v1PublisherPresenter.schema,
      entry: v.object({
        object: v.string({ name: 'object', description: 'Object type' }),
        id: v.string({ name: 'id', description: 'Entry identifier' }),
        identifier: v.string({ name: 'identifier', description: 'Entry identifier string' }),
        name: v.string({ name: 'name', description: 'Entry name' }),
        description: v.nullable(
          v.string({ name: 'description', description: 'Entry description' })
        ),
        metadata: v.nullable(
          v.record(v.any(), {
            name: 'metadata',
            description: 'Custom key-value pairs for storing additional information',
            examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
          })
        ),
        created_at: v.date({ name: 'created_at', description: 'Timestamp when created' }),
        updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated' })
      }),
      default_variant: v.nullable(
        v.object({
          object: v.string({ name: 'object', description: 'Object type' }),
          id: v.string({ name: 'id', description: 'Variant identifier' }),
          tag: v.string({ name: 'tag', description: 'Variant tag' }),
          identifier: v.string({
            name: 'identifier',
            description: 'Variant identifier string'
          }),
          provider_id: v.string({ name: 'provider_id', description: 'Provider ID' }),
          is_default: v.boolean({
            name: 'is_default',
            description: 'Whether this is the default variant'
          }),
          name: v.string({ name: 'name', description: 'Variant name' }),
          description: v.nullable(
            v.string({ name: 'description', description: 'Variant description' })
          ),
          metadata: v.nullable(
            v.record(v.any(), {
              name: 'metadata',
              description: 'Custom key-value pairs for storing additional information',
              examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
            })
          ),
          current_version: v.nullable(v1ProviderVersionPresenter.schema),
          created_at: v.date({ name: 'created_at', description: 'Timestamp when created' }),
          updated_at: v.date({
            name: 'updated_at',
            description: 'Timestamp when last updated'
          })
        })
      ),
      current_version: v.nullable(v1ProviderVersionPresenter.schema),
      type: v1ProviderTypePresenter.schema,
      oauth: v.nullable(
        v.object({
          status: v.string({ name: 'status', description: 'OAuth status' }),
          callback_url: v.nullable(
            v.string({ name: 'callback_url', description: 'OAuth callback URL' })
          ),
          auto_registration: v.nullable(
            v.object({
              status: v.string({ name: 'status', description: 'Auto-registration status' })
            })
          )
        })
      ),
      identifier: v.string({ name: 'identifier', description: 'Provider identifier' }),
      tag: v.string({ name: 'tag', description: 'Provider tag' }),
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
