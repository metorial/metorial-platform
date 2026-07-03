import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectToolCallingConfigurationType } from '../../types';

export let v1ProjectToolCallingConfigurationPresenter = Presenter.create(
  projectToolCallingConfigurationType
)
  .presenter(async ({ project, collectOperationDescriptionForToolCalls, messageProcessingTimeoutMs }) => ({
    object: 'organization.project.tool_calling_configuration' as const,

    project_id: project.id,
    collect_operation_description_for_tool_calls: collectOperationDescriptionForToolCalls,
    message_processing_timeout_ms: messageProcessingTimeoutMs,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.tool_calling_configuration'),
      project_id: v.string(),
      collect_operation_description_for_tool_calls: v.boolean(),
      message_processing_timeout_ms: v.number({ modifiers: [v.positive(), v.integer(), v.minValue(1)] }),
      updated_at: v.date()
    })
  )
  .build();
