import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerToolType } from '../../types';

export let v1ProviderToolPresenter = Presenter.create(providerToolType)
  .presenter(async ({ tool }) => ({
    object: 'provider.tool' as const,
    id: tool.id,

    key: tool.key,
    name: tool.name,
    description: tool.description ?? null,

    capabilities: tool.capabilities ?? {},
    constraints: tool.constraints ?? [],
    instructions: tool.instructions ?? [],

    input_schema: tool.inputJsonSchema
      ? {
          type: 'json_schema',
          schema: tool.inputJsonSchema
        }
      : null,
    output_schema: tool.outputJsonSchema
      ? {
          type: 'json_schema',
          schema: tool.outputJsonSchema
        }
      : null,

    tags: tool.tags
      ? {
          destructive: tool.tags.destructive ?? null,
          read_only: tool.tags.readOnly ?? null
        }
      : null,

    meta: (tool as any).meta ?? null,

    specification_id: tool.specificationId,
    provider_id: tool.providerId,

    created_at: tool.createdAt,
    updated_at: tool.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.tool', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique tool identifier',
        examples: ['pto_5jKlMnPqRsTuVwXy']
      }),
      key: v.string({
        name: 'key',
        description: 'Tool key',
        examples: ['create_issue']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the tool',
        examples: ['Create Issue']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Tool description',
          examples: ['Creates a new issue in a GitHub repository']
        })
      ),
      capabilities: v.record(v.any(), {
        name: 'capabilities',
        description: 'Tool capabilities'
      }),
      constraints: v.array(v.string(), {
        name: 'constraints',
        description: 'Tool constraints'
      }),
      instructions: v.array(v.string(), {
        name: 'instructions',
        description: 'Tool usage instructions'
      }),
      input_schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema defining the tool input parameters'
          })
        })
      ),
      output_schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema defining the tool output format'
          })
        })
      ),
      tags: v.nullable(
        v.object({
          destructive: v.nullable(
            v.boolean({ name: 'destructive', description: 'Whether the tool is destructive' })
          ),
          read_only: v.nullable(
            v.boolean({ name: 'read_only', description: 'Whether the tool is read-only' })
          )
        })
      ),
      meta: v.nullable(
        v.object({
          enabled: v.boolean({ name: 'enabled', description: 'Whether the tool is enabled based on granted scopes' }),
          requiredScopes: v.array(v.string(), { name: 'requiredScopes', description: 'OAuth scopes required by this tool' }),
          missingScopes: v.array(v.string(), { name: 'missingScopes', description: 'OAuth scopes that are required but not granted' })
        })
      ),
      specification_id: v.string({
        name: 'specification_id',
        description: 'Specification ID',
        examples: ['psp_9gHjKlMnPqRsTuVw']
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
