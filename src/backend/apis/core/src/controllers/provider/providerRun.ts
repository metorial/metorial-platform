import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceProviderRunService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerRunLogsPresenter, subspaceProviderRunPresenter } from '../../presenters';

let providerRunGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerRunId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerRunId is required',
        description: 'The providerRunId path parameter is required.'
      })
    );
  }

  let providerRun = await subspaceProviderRunService.get({
    instance: ctx.instance,
    providerRunId: ctx.params.providerRunId
  });

  return { providerRun };
});

export let providerRunController = Controller.create(
  {
    name: 'Provider Runs',
    description:
      'Provider runs track the execution of provider operations within a session. This read-only resource provides visibility into provider activity.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-runs', 'providerRuns.list'), {
        name: 'List all provider runs',
        description: 'Returns a paginated list of provider runs across all sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceProviderRunPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['running', 'stopped']),
                v.array(v.enumOf(['running', 'stopped']))
              ]),
              { description: 'Filter by run status' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            session_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session connection ID(s)'
            }),
            provider_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider version ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderRunService.list({
          instance: ctx.instance,
          allowDeleted: false,

          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          providerVersionIds: normalizeArrayParam(ctx.query.provider_version_id),
          status: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerRun =>
          subspaceProviderRunPresenter.present({
            providerRun
          })
        );
      }),

    get: providerRunGroup
      .get(instancePath('provider-runs/:providerRunId', 'providerRuns.get'), {
        name: 'Get provider run',
        description: 'Retrieves a specific provider run by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceProviderRunPresenter)
      .do(async ctx => {
        return subspaceProviderRunPresenter.present({
          providerRun: ctx.providerRun
        });
      }),

    getLogs: instanceGroup
      .get(instancePath('provider-runs/:providerRunId/logs', 'providerRuns.getLogs'), {
        name: 'Get provider run logs',
        description: 'Retrieves the logs for a specific provider run.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(providerRunLogsPresenter)
      .do(async ctx => {
        let logs = await subspaceProviderRunService.getLogs({
          instance: ctx.instance,
          providerRunId: ctx.params.providerRunId
        });
        return providerRunLogsPresenter.present({ logs });
      })
  }
);
