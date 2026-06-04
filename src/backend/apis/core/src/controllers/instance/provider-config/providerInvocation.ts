import { v } from '@lowerdeck/validation';
import { subspaceProviderInvocationService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import {
  providerInvocationPresenter,
  providerInvocationsPresenter
} from '../../../presenters';

export let providerInvocationController = Controller.create(
  {
    name: 'Provider Invocations',
    description:
      'Provider invocations expose normalized provider-side tracing for tool calls, OAuth flows, and auth config events across Shuttle and Slates.'
  },
  {
    get: instanceGroup
      .get(
        instancePath('provider-invocations/:providerInvocationId', 'providerInvocations.get'),
        {
          name: 'Get provider invocation',
          description: 'Returns a single normalized provider invocation by ID.',
          confidential: true
        }
      )
      .use(isDashboardGroup())
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read', 'instance.provider.auth:read']
        })
      )
      .output(providerInvocationPresenter)
      .do(async ctx => {
        let item = await subspaceProviderInvocationService.get({
          instance: ctx.instance,
          providerInvocationId: ctx.params.providerInvocationId
        });

        return providerInvocationPresenter.present({ providerInvocation: item });
      }),

    list: instanceGroup
      .get(instancePath('provider-invocations', 'providerInvocations.list'), {
        name: 'List provider invocations',
        description:
          'Returns normalized provider invocations and their logs for dashboard diagnostics.',
        confidential: true
      })
      .use(isDashboardGroup())
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read', 'instance.provider.auth:read']
        })
      )
      .output(providerInvocationsPresenter)
      .query(
        'default',
        v.object({
          provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
            description: 'Filter by provider run ID(s)'
          }),
          session_message_id: v.optional(v.union([v.string(), v.array(v.string())]), {
            description: 'Filter by session message ID(s)'
          }),
          auth_config_event_id: v.optional(v.union([v.string(), v.array(v.string())]), {
            description: 'Filter by auth config event ID(s)'
          })
        })
      )
      .do(async ctx => {
        let items = await subspaceProviderInvocationService.list({
          instance: ctx.instance,
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id),
          authConfigEventIds: normalizeArrayParam(ctx.query.auth_config_event_id)
        });

        return providerInvocationsPresenter.present({ items });
      })
  }
);
