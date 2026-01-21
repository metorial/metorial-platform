import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { specificationType } from '../types';
import { v1ToolPresenter } from './tool';
import { v1AuthMethodPresenter } from './authMethod';

export let v1SpecificationPresenter = Presenter.create(specificationType)
  .presenter(async ({ specification }, opts) => ({
    object: 'provider.specification' as const,
    id: specification.id,
    name: specification.name,
    description: specification.description,
    config_schema: specification.configSchema ?? specification.configJsonSchema,
    tools: specification.tools
      ? await Promise.all(
          specification.tools.map((t: any) => v1ToolPresenter.present({ tool: t }, opts).run())
        )
      : [],
    auth_methods: specification.authMethods
      ? await Promise.all(
          specification.authMethods.map((a: any) =>
            v1AuthMethodPresenter.present({ authMethod: a }, opts).run()
          )
        )
      : [],
    provider_id: specification.providerId,
    created_at: specification.createdAt,
    updated_at: specification.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.specification'),
      id: v.string({ name: 'id', description: 'Unique specification identifier', examples: ['spec_abc123def456'] }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['GitHub API v4'] }),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['GitHub GraphQL API specification'] })),
      config_schema: v.nullable(
        v.record(v.any(), { name: 'config_schema', description: 'JSON Schema for configuration', examples: [{ type: 'object', properties: { token: { type: 'string' } } }] })
      ),
      tools: v.array(v1ToolPresenter.schema, { name: 'tools', description: 'Available tools' }),
      auth_methods: v.array(v1AuthMethodPresenter.schema, {
        name: 'auth_methods',
        description: 'Authentication methods'
      }),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
