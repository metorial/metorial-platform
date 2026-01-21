import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { categoryType } from '../types';

export let v1CategoryPresenter = Presenter.create(categoryType)
  .presenter(async ({ category }) => ({
    object: 'provider.category' as const,
    id: category.id,
    name: category.name,
    description: category.description,
    slug: category.slug ?? category.identifier,
    created_at: category.createdAt,
    updated_at: category.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.category'),
      id: v.string({ name: 'id', description: 'Unique category identifier', examples: ['cat_abc123def456'] }),
      name: v.string({ name: 'name', description: 'Display name of the category', examples: ['Developer Tools', 'Data & Analytics'] }),
      description: v.nullable(
        v.string({ name: 'description', description: 'Description of providers in this category', examples: ['Tools for software development and CI/CD'] })
      ),
      slug: v.string({ name: 'slug', description: 'URL-friendly identifier', examples: ['developer-tools'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
