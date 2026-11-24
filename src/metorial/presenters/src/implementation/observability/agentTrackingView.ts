import { v } from '@lowerdeck/validation';
import {
  agentTrackingViewPages,
  teamViewKinds,
  teamViewParamsValidator
} from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import { agentTrackingViewType } from '../../types';
import { v1OrganizationActorPresenter } from '../organization/organizationActor';

export let v1AgentTrackingViewPresenter = Presenter.create(agentTrackingViewType)
  .presenter(async ({ view }, opts) => ({
    object: 'agent_tracking.view' as const,

    id: view.id,
    name: view.name,
    page: view.page,
    kind: view.kind,
    params: view.params,

    created_by: view.creatorActor
      ? await v1OrganizationActorPresenter
          .present({ organizationActor: view.creatorActor }, opts)
          .run()
      : null,

    created_at: view.createdAt,
    updated_at: view.updatedAt,
    deleted_at: view.deletedAt
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.view', {
        description: 'String representing the object’s type.'
      }),

      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['atvw_0mhNnEqM7XQb3vXq8gD2']
      }),
      name: v.string({
        name: 'name',
        description:
          'Display name. Unique on its page within the instance, compared without regard to case.',
        examples: ['High effort, last 30 days']
      }),
      page: v.enumOf(agentTrackingViewPages, {
        name: 'page',
        description: 'Agent usage page the view belongs to.'
      }),
      kind: v.enumOf(teamViewKinds, {
        name: 'kind',
        description:
          'Built-in view the saved view starts from. It sets the columns the page shows.'
      }),
      params: teamViewParamsValidator,

      created_by: v.nullable(v1OrganizationActorPresenter.schema, {
        description:
          'Organization actor who saved the view. `null` once that actor is removed.'
      }),

      created_at: v.date({ name: 'created_at', description: 'Creation time.' }),
      updated_at: v.date({ name: 'updated_at', description: 'Last update time.' }),
      deleted_at: v.nullable(
        v.date({
          name: 'deleted_at',
          description: 'When this was deleted. `null` while active.'
        })
      )
    })
  )
  .build();
