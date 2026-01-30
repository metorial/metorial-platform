import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { toolType } from '../../types';

export let v1ToolPresenter = Presenter.create(toolType)
  .presenter(async ({ tool }) => ({
    object: 'provider.tool' as const,
    id: tool.id,
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema ?? tool.inputJsonSchema,
    output_schema: tool.outputSchema ?? tool.outputJsonSchema,
    provider_id: tool.providerId,
    provider_specification_id: tool.providerSpecificationId ?? tool.specificationId,
    created_at: tool.createdAt,
    updated_at: tool.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.tool', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique tool identifier', examples: ['pto_5jKlMnPqRsTuVwXy'] }),
      name: v.string({ name: 'name', description: 'Display name of the tool', examples: ['create_issue', 'search_code'] }),
      description: v.nullable(v.string({ name: 'description', description: 'Tool description', examples: ['Creates a new issue in a GitHub repository'] })),
      input_schema: v.nullable(
        v.record(v.any(), {
          name: 'input_schema',
          description: 'JSON Schema defining the tool input parameters. Contains standard JSON Schema fields like type, properties, required, etc.',
          examples: [
            {
              type: 'object',
              properties: {
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' }
              },
              required: ['repo', 'title']
            }
          ]
        })
      ),
      output_schema: v.nullable(
        v.record(v.any(), {
          name: 'output_schema',
          description: 'JSON Schema defining the tool output format. Contains standard JSON Schema fields like type, properties, required, etc.',
          examples: [
            {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Issue ID' },
                url: { type: 'string', description: 'Issue URL' }
              }
            }
          ]
        })
      ),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pro_5gHjKlMnPqRsTuVw'] }),
      provider_specification_id: v.string({
        name: 'provider_specification_id',
        description: 'Specification ID',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
