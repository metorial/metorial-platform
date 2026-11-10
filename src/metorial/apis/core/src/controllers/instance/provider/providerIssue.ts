import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { ProviderIssueType } from '@metorial-subspace/db';
import { providerIssueService } from '@metorial-subspace/module-provider-issue';
import type { Scope } from '@metorial/module-access';
import { subspaceProviderIssuePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess, hasAccess } from '../../../middleware/checkAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';

let issueTypes = ['provider_error', 'auth_error', 'protoguard_warning'] as const;

let issueTypeScopes: Record<ProviderIssueType, Scope> = {
  provider_error: 'instance.provider.session:read',
  auth_error: 'instance.provider.auth:read',
  protoguard_warning: 'instance.monitor:read'
};

let issueAccessGroup = integrationsGroup
  .use(requireNonPublishableMachineAccess())
  .use(checkAccess({ possibleScopes: Object.values(issueTypeScopes) }))
  .use(async ctx => {
    let allowedIssueTypes: ProviderIssueType[] = [];

    for (let type of issueTypes) {
      if (await hasAccess(ctx, { possibleScopes: [issueTypeScopes[type]] })) {
        allowedIssueTypes.push(type);
      }
    }

    return { allowedIssueTypes };
  });

let providerIssueGroup = issueAccessGroup.use(async ctx => {
  if (!ctx.params.providerIssueId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerIssueId is required',
        description: 'The providerIssueId path parameter is required.'
      })
    );
  }

  let providerIssue = await providerIssueService.getProviderIssueById({
    instance: ctx.instance,
    providerIssueId: ctx.params.providerIssueId
  });
  if (!ctx.allowedIssueTypes.includes(providerIssue.type)) {
    throw new ServiceError(notFoundError('provider.issue', ctx.params.providerIssueId));
  }

  return { providerIssue };
});

export let providerIssueController = Controller.create(
  {
    name: 'Provider Issues',
    description:
      'Provider issues aggregate repeated provider errors, authentication failures and ProtoGuard warnings into one record per distinct problem.'
  },
  {
    list: issueAccessGroup
      .get(instancePath('provider-issues', 'providerIssues.list'), {
        name: 'List provider issues',
        description:
          'Returns a paginated list of provider issues. Only issue types the caller has read access to are included.'
      })
      .outputList(subspaceProviderIssuePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([v.enumOf([...issueTypes]), v.array(v.enumOf([...issueTypes]))]),
              {
                description: 'Filter by issue type(s)'
              }
            ),
            severity: v.optional(
              v.union([
                v.enumOf(['warning', 'error', 'critical']),
                v.array(v.enumOf(['warning', 'error', 'critical']))
              ]),
              { description: 'Filter by severity' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider issue ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            last_seen_at: dateFilterValidator('provider issue last occurrence time'),
            created_at: dateFilterValidator('provider issue creation time'),
            search: v.optional(
              v.string({
                description:
                  'Search by issue ID, code, subtype or message, or by the name of the related provider',
                examples: ['github']
              })
            )
          })
        )
      )
      .do(async ctx => {
        let requestedTypes = normalizeArrayParam(ctx.query.type);

        let paginator = await providerIssueService.listProviderIssues({
          instance: ctx.instance,
          types: (requestedTypes ?? issueTypes).filter(type =>
            ctx.allowedIssueTypes.includes(type)
          ),
          severities: normalizeArrayParam(ctx.query.severity),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          lastSeenAt: ctx.query.last_seen_at,
          createdAt: ctx.query.created_at,
          search: ctx.query.search
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerIssue =>
          subspaceProviderIssuePresenter.present({ providerIssue })
        );
      }),

    get: providerIssueGroup
      .get(instancePath('provider-issues/:providerIssueId', 'providerIssues.get'), {
        name: 'Get provider issue',
        description: 'Retrieves a specific provider issue.'
      })
      .output(subspaceProviderIssuePresenter)
      .do(async ctx =>
        subspaceProviderIssuePresenter.present({ providerIssue: ctx.providerIssue })
      )
  }
);
