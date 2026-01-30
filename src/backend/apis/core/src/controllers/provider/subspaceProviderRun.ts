import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderRunService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerPath } from '../../middleware/providerGroup';
import { subspaceProviderRunPresenter } from '../../presenters';
import { SubspaceProviderRun } from '../../presenters/types';
import { subspaceSessionGroup } from './subspaceSession';

export let subspaceProviderRunGroup = subspaceSessionGroup.use(async ctx => {
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

export let subspaceProviderRunController = Controller.create(
  {
    name: 'Provider Runs',
    description:
      'Provider runs track the execution of provider operations within a session. This read-only resource provides visibility into provider activity.'
  },
  {
    list: subspaceSessionGroup
      .get(providerPath('sessions/:sessionId/provider-runs', 'sessions.providerRuns.list'), {
        name: 'List provider runs',
        description: 'Returns a paginated list of provider runs for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(subspaceProviderRunPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(v.string(), { description: 'Filter by run status' }),
            provider_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by provider ID(s)' }
            ),
            session_provider_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by session provider ID(s)' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderRunService.list({
          instance: ctx.instance,
          sessionId: ctx.session.id,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          status: ctx.query.status
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerRun =>
          subspaceProviderRunPresenter.present({ providerRun: providerRun as SubspaceProviderRun })
        );
      }),

    get: subspaceProviderRunGroup
      .get(providerPath('sessions/:sessionId/provider-runs/:providerRunId', 'sessions.providerRuns.get'), {
        name: 'Get provider run',
        description: 'Retrieves a specific provider run for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(subspaceProviderRunPresenter)
      .do(async ctx => {
        return subspaceProviderRunPresenter.present({ providerRun: ctx.providerRun });
      })
  }
);
