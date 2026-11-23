import { v } from '@lowerdeck/validation';
type ProviderPreviewInput = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  prettySlug?: string | null;
};

export let v1ProviderPreview = Object.assign(
  (provider: ProviderPreviewInput) => ({
    object: 'provider#preview' as const,
    id: provider.id,

    name: provider.name,
    description: provider.description,
    slug: provider.prettySlug ?? provider.slug,

    created_at: provider.createdAt,
    updated_at: provider.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('provider#preview', {
        description: 'String representing the object’s type.'
      }),

      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),

      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['GitHub']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Connect to GitHub repositories, issues, and pull requests']
        })
      ),

      slug: v.string({
        name: 'slug',
        description: 'URL-safe name for the provider.',
        examples: ['github']
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  }
);
