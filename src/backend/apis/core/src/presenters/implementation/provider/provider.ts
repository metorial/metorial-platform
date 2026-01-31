import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerType } from '../../types';
import { v1PublisherPresenter } from './publisher';
import { v1VersionPresenter } from './version';

export let v1ProviderPresenter = Presenter.create(providerType)
  .presenter(async ({ provider }, opts) => ({
    object: 'provider' as const,
    id: provider.id,
    name: provider.name ?? provider.entry?.name,
    description: provider.description ?? provider.entry?.description,
    slug: provider.slug ?? provider.tag ?? provider.identifier,
    publisher: await v1PublisherPresenter
      .present({ publisher: provider.publisher }, opts)
      .run(),
    current_version: provider.currentVersion
      ? await v1VersionPresenter.present({ version: provider.currentVersion }, opts).run()
      : null,
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
      name: v.string({
        name: 'name',
        description: 'Display name of the provider',
        examples: ['GitHub']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Brief description of the provider',
          examples: ['Connect to GitHub repositories, issues, and pull requests']
        })
      ),
      slug: v.string({
        name: 'slug',
        description: 'URL-friendly identifier',
        examples: ['github']
      }),
      publisher: v1PublisherPresenter.schema,
      current_version: v.nullable(v1VersionPresenter.schema),
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
