import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectDataRetentionConfigurationType } from '../../types';

export let v1ProjectDataRetentionConfigurationPresenter = Presenter.create(
  projectDataRetentionConfigurationType
)
  .presenter(
    async ({ project, dataRetentionLevel, storeToolCallAttachments, collectErrors }) => ({
      object: 'organization.project.data_retention_configuration' as const,

      project_id: project.id,
      data_retention_level: dataRetentionLevel,
      store_tool_call_attachments: storeToolCallAttachments,
      collect_errors: collectErrors,
      updated_at: project.updatedAt
    })
  )
  .schema(
    v.object({
      object: v.literal('organization.project.data_retention_configuration'),
      project_id: v.string(),
      data_retention_level: v.enumOf(['full', 'intent_only', 'none'], {
        description:
          'How much message data is stored. `full` stores message contents and tool calls. `intent_only` stores tool names and operation descriptions but no message contents. `none` stores sessions and connections only.'
      }),
      store_tool_call_attachments: v.boolean({
        description:
          'Whether tool call attachment URLs are extracted and stored. Always false when data_retention_level is none.'
      }),
      collect_errors: v.boolean({
        description:
          'Whether session errors are recorded at all. Always true when data_retention_level is full. When true below full, only the error code and message are stored verbatim -- the error payload is stored with its shape preserved but every value redacted.'
      }),
      updated_at: v.date()
    })
  )
  .build();
