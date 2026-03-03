import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { providerSpecificationType } from '../../types';
import { v1ProviderAuthMethodPresenter } from './authMethod';
import { v1ProviderToolPresenter } from './providerTool';

export let v1ProviderSpecificationPresenter = Presenter.create(providerSpecificationType)
  .presenter(async ({ specification }, opts) => ({
    object: 'provider.specification' as const,

    id: specification.id,
    key: specification.key,

    name: specification.name,
    description: specification.description,

    config_schema: specification.configSchema,
    config_visibility: specification.configVisibility,

    tools: await Promise.all(
      specification.tools.map(t => v1ProviderToolPresenter.present({ tool: t }, opts).run())
    ),

    auth_methods: await Promise.all(
      specification.authMethods.map(a =>
        v1ProviderAuthMethodPresenter.present({ authMethod: a }, opts).run()
      )
    ),

    provider_id: specification.providerId,

    created_at: specification.createdAt,
    updated_at: specification.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.specification', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique specification identifier',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      key: v.string({
        name: 'key',
        description: 'Unique specification key',
        examples: ['github']
      }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['GitHub'] }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['GitHub API integration']
        })
      ),
      config_schema: v.record(v.any(), {
        name: 'config_schema',
        description: 'JSON Schema defining the configuration structure',
        examples: [
          {
            type: 'object',
            properties: {
              base_url: { type: 'string', description: 'Base URL for the API' }
            },
            required: ['base_url']
          }
        ]
      }),
      config_visibility: v.enumOf(['encrypted', 'plain'] as const, {
        name: 'config_visibility',
        description: 'Visibility level of the configuration'
      }),
      tools: v.array(v1ProviderToolPresenter.schema, {
        name: 'tools',
        description: 'Available tools'
      }),
      auth_methods: v.array(v1ProviderAuthMethodPresenter.schema, {
        name: 'auth_methods',
        description: 'Authentication methods'
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
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
