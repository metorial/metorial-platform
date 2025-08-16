import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerDeploymentType } from '../types';
import { v1OrganizationActorPresenter } from './organizationActor';

export let v1CustomServerDeploymentPresenter = Presenter.create(customServerDeploymentType)
  .presenter(async ({ customServerDeployment }, opts) => ({
    object: 'custom_server.deployment',

    id: customServerDeployment.id,

    status: {
      queued: 'queued',
      deploying: 'deploying',
      completed: 'completed',
      failed: 'failed'
    }[customServerDeployment.status],

    trigger: {
      manual: 'manual'
    }[customServerDeployment.trigger],

    creator_actor: await v1OrganizationActorPresenter
      .present({ organizationActor: customServerDeployment.creatorActor }, opts)
      .run(),

    custom_server_id: customServerDeployment.customServer.id,
    custom_server_version_id: customServerDeployment.customServerVersion?.id ?? null,

    created_at: customServerDeployment.createdAt,
    updated_at: customServerDeployment.updatedAt,
    started_at: customServerDeployment.startedAt ?? null,
    ended_at: customServerDeployment.endedAt ?? null,

    steps: customServerDeployment.steps.map(step => ({
      object: 'custom_server.deployment.step',
      id: step.id,
      index: step.index,

      status: {
        running: 'running',
        completed: 'completed',
        failed: 'failed'
      }[step.status],

      type: {
        started: 'started',
        remote_server_connection_test: 'remote_server_connection_test',
        remote_oauth_auto_discovery: 'remote_oauth_auto_discovery',
        deploying: 'deploying',
        deployed: 'deployed'
      }[step.type],

      logs: (step.logs ?? []).flatMap(([ts, lines, type]) =>
        lines.map(line => ({
          timestamp: new Date(ts),
          line,
          type: type == 1 ? 'error' : 'info'
        }))
      ),

      created_at: step.createdAt,
      started_at: step.startedAt ?? null,
      ended_at: step.endedAt ?? null
    }))
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.deployment'),

      id: v.string({
        name: 'id',
        description: `The custom server deployment's unique identifier`
      }),

      status: v.enumOf(['queued', 'deploying', 'completed', 'failed'], {
        name: 'status',
        description: `The current status of the custom server deployment`
      }),

      trigger: v.enumOf(['manual'], {
        name: 'trigger',
        description: `The trigger type for the custom server deployment`
      }),

      creator_actor: v1OrganizationActorPresenter.schema,

      custom_server_id: v.string({
        name: 'custom_server_id',
        description: `The ID of the custom server associated with this deployment`
      }),

      custom_server_version_id: v.nullable(
        v.string({
          name: 'custom_server_version_id',
          description: `The ID of the custom server version associated with this deployment, if applicable`
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: `The timestamp when the custom server deployment was created`
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: `The timestamp when the custom server deployment was last updated`
      }),

      started_at: v.nullable(
        v.date({
          name: 'started_at',
          description: `The timestamp when the custom server deployment started`
        })
      ),

      ended_at: v.nullable(
        v.date({
          name: 'ended_at',
          description: `The timestamp when the custom server deployment ended`
        })
      ),

      steps: v.array(
        v.object({
          object: v.literal('custom_server.deployment.step'),

          id: v.string({
            name: 'id',
            description: `The custom server deployment step's unique identifier`
          }),

          index: v.number({
            name: 'index',
            description: `The index of the step in the deployment process`
          }),

          status: v.enumOf(['running', 'completed', 'failed'], {
            name: 'status',
            description: `The current status of the custom server deployment step`
          }),

          type: v.enumOf(
            [
              'started',
              'remote_server_connection_test',
              'remote_oauth_auto_discovery',
              'deploying',
              'deployed'
            ],
            {
              name: 'type',
              description: `The type of the custom server deployment step`
            }
          ),

          logs: v.array(
            v.object({
              timestamp: v.date({
                name: 'timestamp',
                description: `The timestamp when the log entry was created`
              }),
              line: v.string({
                name: 'line',
                description: `The log message line`
              }),
              type: v.enumOf(['info', 'error'], {
                name: 'type',
                description: `The type of the log entry`
              })
            })
          ),

          created_at: v.date({
            name: 'created_at',
            description: `The timestamp when the custom server deployment step was created`
          }),

          started_at: v.nullable(
            v.date({
              name: 'started_at',
              description: `The timestamp when the custom server deployment step started`
            })
          ),

          ended_at: v.nullable(
            v.date({
              name: 'ended_at',
              description: `The timestamp when the custom server deployment step ended`
            })
          )
        })
      )
    })
  )
  .build();
