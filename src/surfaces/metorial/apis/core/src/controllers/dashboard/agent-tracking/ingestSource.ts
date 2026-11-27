import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { agentTrackingIngestSourceService } from '@metorial/module-agent-tracking-access';
import {
  agentTrackingClientFamilyKeys,
  getAgentTrackingIngestPublicUrl
} from '@metorial/module-agent-tracking-sync';
import { agentTrackingIngestSourcePresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { requireAgentTrackingEnabled } from '../../../middleware/requireAgentTrackingEnabled';

let readScopes = ['instance.agent_tracking:read'] as const;
let writeScopes = ['instance.agent_tracking:write'] as const;

let ingestSourceStatuses = ['active', 'revoked'] as const;

let basePath = '/dashboard/instances/:instanceId/agent-tracking/ingest-sources';

let agentTrackingGroup = instanceGroup
  .use(isDashboardGroup())
  .use(requireAgentTrackingEnabled('agent_tracking.ingest_source'));

let issueGroup = agentTrackingGroup.use(async () => {
  if (!getAgentTrackingIngestPublicUrl()) {
    throw new ServiceError(notFoundError('agent_tracking.ingest_source'));
  }
});

let ingestSourceGroup = agentTrackingGroup.use(async ctx => {
  let ingestSource = await agentTrackingIngestSourceService.getIngestSourceById({
    instance: ctx.instance,
    ingestSourceId: requireParam(ctx.params, 'ingestSourceId')
  });

  return { ingestSource };
});

export let dashboardAgentTrackingIngestSourceController = Controller.create(
  {
    name: 'Agent Tracking Ingestion Keys',
    description:
      'Create, list and revoke the keys AI coding agents use to send their usage to agent tracking.',
    hideInDocs: true
  },
  {
    list: agentTrackingGroup
      .get(Path(basePath, 'dashboard.instance.agentTracking.ingestSources.list'), {
        name: 'List ingestion keys',
        description: 'Returns the ingestion keys of the instance. Defaults to active keys.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union(
                [v.enumOf(ingestSourceStatuses), v.array(v.enumOf(ingestSourceStatuses))],
                {
                  name: 'status',
                  description: 'Only return keys with these statuses. Defaults to active.',
                  examples: ['active']
                }
              )
            )
          })
        )
      )
      .outputList(agentTrackingIngestSourcePresenter)
      .do(async ctx => {
        let paginator = await agentTrackingIngestSourceService.listIngestSources({
          instance: ctx.instance,
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, view =>
          agentTrackingIngestSourcePresenter.present(view)
        );
      }),

    create: issueGroup
      .post(Path(basePath, 'dashboard.instance.agentTracking.ingestSources.create'), {
        name: 'Create ingestion key',
        description:
          'Creates an ingestion key for the instance. The key is in the response once and cannot be read again.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          name: v.string({
            name: 'name',
            description:
              'A name that tells the keys apart, such as where the key is deployed.',
            examples: ['Engineering laptops'],
            modifiers: [v.minLength(1), v.maxLength(200)]
          }),
          client_family: v.enumOf(agentTrackingClientFamilyKeys, {
            name: 'client_family',
            description:
              'The AI coding agent that sends usage with this key. Only claude_code for now.'
          })
        })
      )
      .output(agentTrackingIngestSourcePresenter)
      .do(async ctx => {
        let view = await agentTrackingIngestSourceService.createIngestSource({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: { name: ctx.body.name, clientFamily: ctx.body.client_family }
        });

        return agentTrackingIngestSourcePresenter.present(view);
      }),

    get: ingestSourceGroup
      .get(
        Path(
          `${basePath}/:ingestSourceId`,
          'dashboard.instance.agentTracking.ingestSources.get'
        ),
        {
          name: 'Get ingestion key',
          description: 'Retrieves an ingestion key of the instance, without its secret.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(agentTrackingIngestSourcePresenter)
      .do(async ctx => {
        let view = await agentTrackingIngestSourceService.describeIngestSource({
          ingestSource: ctx.ingestSource
        });

        return agentTrackingIngestSourcePresenter.present(view);
      }),

    revoke: ingestSourceGroup
      .post(
        Path(
          `${basePath}/:ingestSourceId/revoke`,
          'dashboard.instance.agentTracking.ingestSources.revoke'
        ),
        {
          name: 'Revoke ingestion key',
          description:
            'Revokes an ingestion key. Data sent with it is rejected once the revocation reaches agent tracking, usually within seconds. Revoking a revoked key changes nothing.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(agentTrackingIngestSourcePresenter)
      .do(async ctx => {
        let view = await agentTrackingIngestSourceService.revokeIngestSource({
          ingestSource: ctx.ingestSource,
          auditScope: ctx.auditScope
        });

        return agentTrackingIngestSourcePresenter.present(view);
      })
  }
);
