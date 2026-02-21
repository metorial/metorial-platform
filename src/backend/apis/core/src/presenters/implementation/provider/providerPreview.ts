import { SubspaceProvider } from '@metorial/module-subspace';
import { v } from '@metorial/validation';

export let v1ProviderPreview = Object.assign(
  (provider: SubspaceProvider) => ({
    object: 'provider#preview' as const,
    id: provider.id,

    name: provider.name,
    description: provider.description,
    slug: provider.slug,

    created_at: provider.createdAt,
    updated_at: provider.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('provider#preview', {
        description: "String representing the object's type"
      }),

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

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the provider was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the provider was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  }
);
