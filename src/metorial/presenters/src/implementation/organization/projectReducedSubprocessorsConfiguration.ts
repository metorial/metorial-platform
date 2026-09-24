import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectReducedSubprocessorsConfigurationType } from '../../types';

export let v1ProjectReducedSubprocessorsConfigurationPresenter = Presenter.create(
  projectReducedSubprocessorsConfigurationType
)
  .presenter(async ({ project, reducedSubprocessors }) => ({
    object: 'organization.project.reduced_subprocessors_configuration' as const,
    project_id: project.id,
    reduced_subprocessors: reducedSubprocessors,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.reduced_subprocessors_configuration'),
      project_id: v.string(),
      reduced_subprocessors: v.boolean(),
      updated_at: v.date()
    })
  )
  .build();
