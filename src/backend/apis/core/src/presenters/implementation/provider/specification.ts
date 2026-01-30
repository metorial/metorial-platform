import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { specificationType } from '../../types';
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
          specification.tools.map(t => v1ToolPresenter.present({ tool: t }, opts).run())
        )
      : [],
    auth_methods: specification.authMethods
      ? await Promise.all(
          specification.authMethods.map(a =>
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
      object: v.literal('provider.specification', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique specification identifier', examples: ['psp_9gHjKlMnPqRsTuVw'] }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['GitHub'] }),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['GitHub API integration'] })),
      config_schema: v.nullable(
        v.record(v.any(), {
          name: 'config_schema',
          description: 'JSON Schema defining the configuration structure. Contains standard JSON Schema fields like type, properties, required, etc.',
          examples: [
            {
              type: 'object',
              properties: {
                base_url: { type: 'string', description: 'Base URL for the API' },
                timeout: { type: 'number', description: 'Request timeout in milliseconds' }
              },
              required: ['base_url']
            }
          ]
        })
      ),
      tools: v.array(v1ToolPresenter.schema, { name: 'tools', description: 'Available tools' }),
      auth_methods: v.array(v1AuthMethodPresenter.schema, {
        name: 'auth_methods',
        description: 'Authentication methods'
      }),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pro_5gHjKlMnPqRsTuVw'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
