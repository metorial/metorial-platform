import { v } from '@lowerdeck/validation';
import { instanceService } from '@metorial/module-organization';
import {
  usageGroupByValues,
  usageIntervalValues,
  usageMetricKinds,
  usageService
} from '@metorial/module-usage';
import { Controller, Path } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup } from '../../middleware/instanceGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import {
  instanceUsageSummaryPresenter,
  instanceUsageTimelinePresenter,
  usagePresenter
} from '@metorial/presenters';

export let dashboardUsageController = Controller.create(
  {
    name: 'Usage',
    description: 'Get usage information'
  },
  {
    getTimeline: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/usage/timeline',
          'dashboard.usage.timeline'
        ),
        {
          name: 'Get organization usage timeline',
          description: 'Get usage counts over time for every instance of the organization.'
        }
      )
      .query(
        'default',
        v.object({
          entities: v.array(v.object({ type: v.string(), id: v.optional(v.string()) })),
          from: v.date(),
          to: v.date(),
          interval: v.object({
            unit: v.union([v.literal('day'), v.literal('hour')]),
            count: v.number()
          })
        })
      )
      .output(usagePresenter)
      .do(async ctx => {
        let instances = await instanceService.getManyInstancesForOrganization({
          organization: ctx.organization
        });

        let timeline = await usageService.getUsageTimeline({
          owners: [
            { type: 'organization', id: ctx.organization.id },
            ...instances.map(i => ({ type: 'instance' as const, id: i.id }))
          ],
          entities: ctx.query.entities,
          from: ctx.query.from,
          to: ctx.query.to,
          interval: ctx.query.interval
        });

        return usagePresenter.present({ timeline });
      })
  }
);

let usageKindValidator = v.enumOf([...usageMetricKinds]);
let idFilterValidator = (description: string) =>
  v.optional(v.union([v.string(), v.array(v.string())]), { description });

let instanceUsageQueryFields = {
  kind: v.union([usageKindValidator, v.array(usageKindValidator)], {
    description: 'One or more usage metrics to include, for example `tool_call`.'
  }),
  from: v.date({ description: 'Inclusive start of the range.' }),
  to: v.date({ description: 'Exclusive end of the range.' }),
  provider_id: idFilterValidator('Only include usage of these providers.'),
  deployment_id: idFilterValidator('Only include usage of these provider deployments.'),
  consumer_id: idFilterValidator('Only include usage of these consumers.'),
  consumer_profile_id: idFilterValidator('Only include usage of these consumer profiles.'),
  magic_mcp_server_id: idFilterValidator('Only include usage of these Magic MCP servers.'),
  integration_id: idFilterValidator('Only include usage of these integrations.'),
  error_type: idFilterValidator('Only include errors of these types.'),
  group_by: v.optional(
    v.enumOf(usageGroupByValues, {
      description: 'Split the result by kind or by a dimension such as provider or tool.'
    })
  ),
  max_series: v.optional(
    v.number({
      description: 'Maximum number of groups returned before the rest are combined.',
      examples: [10],
      modifiers: [v.minValue(1), v.maxValue(50)]
    })
  )
};

let getInstanceUsageQuery = (query: {
  kind: (typeof usageMetricKinds)[number] | (typeof usageMetricKinds)[number][];
  from: Date;
  to: Date;
  provider_id?: string | string[];
  deployment_id?: string | string[];
  consumer_id?: string | string[];
  consumer_profile_id?: string | string[];
  magic_mcp_server_id?: string | string[];
  integration_id?: string | string[];
  error_type?: string | string[];
  group_by?: (typeof usageGroupByValues)[number];
  max_series?: number;
}) => ({
  kinds: normalizeArrayParam(query.kind) ?? [],
  from: query.from,
  to: query.to,
  groupBy: query.group_by,
  maxSeries: query.max_series,
  filters: {
    providerId: normalizeArrayParam(query.provider_id),
    deploymentId: normalizeArrayParam(query.deployment_id),
    consumerId: normalizeArrayParam(query.consumer_id),
    consumerProfileId: normalizeArrayParam(query.consumer_profile_id),
    magicMcpServerId: normalizeArrayParam(query.magic_mcp_server_id),
    integrationId: normalizeArrayParam(query.integration_id),
    errorType: normalizeArrayParam(query.error_type)
  }
});

export let dashboardInstanceUsageController = Controller.create(
  {
    name: 'Instance Usage',
    description: 'Read aggregated usage metrics for an instance.',
    hideInDocs: true
  },
  {
    getTimeline: instanceGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/instances/:instanceId/usage/timeline',
          'dashboard.instances.usage.timeline'
        ),
        {
          name: 'Get instance usage timeline',
          description: 'Returns bucketed usage metrics for the instance over a time range.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .query(
        'default',
        v.object({
          ...instanceUsageQueryFields,
          interval: v.optional(
            v.enumOf(usageIntervalValues, {
              description: 'Bucket size. Picked automatically from the range when omitted.'
            })
          )
        })
      )
      .output(instanceUsageTimelinePresenter)
      .do(async ctx => {
        let timeline = await usageService.getTimeline({
          ...getInstanceUsageQuery(ctx.query),
          instanceIds: [ctx.instance.id],
          interval: ctx.query.interval
        });

        return instanceUsageTimelinePresenter.present({
          instanceId: ctx.instance.id,
          timeline
        });
      }),

    getSummary: instanceGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/instances/:instanceId/usage/summary',
          'dashboard.instances.usage.summary'
        ),
        {
          name: 'Get instance usage summary',
          description: 'Returns usage totals for the instance over a time range.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .query('default', v.object(instanceUsageQueryFields))
      .output(instanceUsageSummaryPresenter)
      .do(async ctx => {
        let summary = await usageService.getSummary({
          ...getInstanceUsageQuery(ctx.query),
          instanceIds: [ctx.instance.id]
        });

        return instanceUsageSummaryPresenter.present({ instanceId: ctx.instance.id, summary });
      })
  }
);
