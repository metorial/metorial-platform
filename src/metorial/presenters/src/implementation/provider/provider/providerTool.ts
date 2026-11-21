import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerToolType } from '../../../types';

export let v1ProviderToolPresenter = Presenter.create(providerToolType)
  .presenter(async ({ tool }) => ({
    object: 'provider.tool' as const,
    id: tool.id,

    key: tool.key,
    name: tool.name,
    description: tool.description ?? null,

    capabilities: tool.value.capabilities ?? {},
    constraints: tool.value.constraints ?? [],
    instructions: tool.value.instructions ?? [],

    input_schema: tool.value.inputJsonSchema
      ? {
          type: 'json_schema',
          schema: tool.value.inputJsonSchema
        }
      : null,
    output_schema: tool.value.outputJsonSchema
      ? {
          type: 'json_schema',
          schema: tool.value.outputJsonSchema
        }
      : null,

    tags: tool.value.tags
      ? {
          destructive: tool.value.tags.destructive ?? null,
          read_only: tool.value.tags.readOnly ?? null
        }
      : null,

    tool_category_keys: tool.value.categories ?? [],

    specification_id: tool.specification.id,
    provider_id: tool.provider.id,

    created_at: tool.createdAt,
    updated_at: tool.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.tool', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pto_5jKlMnPqRsTuVwXy']
      }),
      key: v.string({
        name: 'key',
        description: 'Key used to call the tool over MCP.',
        examples: ['create_issue']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Create Issue']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Creates a new issue in a GitHub repository']
        })
      ),
      capabilities: v.record(v.any(), {
        name: 'capabilities',
        description: 'What the tool can do.'
      }),
      constraints: v.array(v.string(), {
        name: 'constraints',
        description: 'Rules for using the tool.'
      }),
      instructions: v.array(v.string(), {
        name: 'instructions',
        description: 'Guidance for calling the tool correctly.'
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
            v.boolean({
              name: 'destructive',
              description: 'Whether the tool changes or deletes data.'
            })
          ),
          read_only: v.nullable(
            v.boolean({ name: 'read_only', description: 'Whether the tool only reads data.' })
          )
        })
      ),
      tool_category_keys: v.array(v.string(), {
        name: 'tool_category_keys',
        description: 'Keys of the tool categories this tool belongs to',
        examples: [['crm']]
      }),
      specification_id: v.string({
        name: 'specification_id',
        description: 'Specification this tool belongs to.',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this tool belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
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
  )
  .build();
