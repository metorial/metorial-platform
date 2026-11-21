import { v } from '@lowerdeck/validation';
import {
  agentTrackingSpendService,
  breakdownGroupKeys
} from '@metorial/module-agent-tracking-query';
import {
  agentTrackingSpendBreakdownPresenter,
  agentTrackingSpendTimelinePresenter
} from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { idFilter, rangeOf } from '../../../lib/agentTrackingParams';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { agentTrackingBasePath, agentTrackingReadGroup, rangeQueryFields } from './readGroup';

let spendFilterFields = {
  client_family: idFilter(
    'client_family',
    'Only count usage of these AI coding agents, by client family as filter-values lists them for field=client.',
    ['claude_code']
  ),
  model_id: idFilter(
    'model_id',
    'Only count usage of these models. unknown selects usage whose model is not matched to the model catalog (Unknown Model).',
    ['claude-sonnet-4-5', 'unknown']
  )
};

let spendFiltersOf = (query: {
  client_family?: string | string[];
  model_id?: string | string[];
}) => ({
  clientFamilies: normalizeArrayParam(query.client_family),
  modelIds: normalizeArrayParam(query.model_id)
});

export let dashboardAgentTrackingSpendController = Controller.create(
  {
    name: 'Agent Tracking Spend',
    description: 'What AI coding agents cost, over time and by member or model.',
    hideInDocs: true
  },
  {
    timeline: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/spend/timeline`,
          'dashboard.instance.agentTracking.spend.timeline'
        ),
        {
          name: 'Get spend timeline',
          description:
            'Returns the cost, tokens, active sessions and active members of the instance per day over a range, with the totals of the range and the period before it. Filters apply to all of them. Results can be up to a minute old.',
          hideInDocs: true
        }
      )
      .query('default', v.object({ ...rangeQueryFields, ...spendFilterFields }))
      .output(agentTrackingSpendTimelinePresenter)
      .do(async ctx => {
        let timeline = await agentTrackingSpendService.getTimeline({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          range: rangeOf(ctx.query),
          filters: spendFiltersOf(ctx.query)
        });

        return agentTrackingSpendTimelinePresenter.present({ timeline });
      }),

    breakdown: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/spend/breakdown`,
          'dashboard.instance.agentTracking.spend.breakdown'
        ),
        {
          name: 'Get spend breakdown',
          description:
            'Returns the cost of the instance over a range by member or by model: the top 10 with their share of the total, then everything else as one item. Results can be up to a minute old.',
          hideInDocs: true
        }
      )
      .query(
        'default',
        v.object({
          group_by: v.enumOf(breakdownGroupKeys, {
            name: 'group_by',
            description: 'Group the cost by member or by model.'
          }),
          ...rangeQueryFields,
          ...spendFilterFields
        })
      )
      .output(agentTrackingSpendBreakdownPresenter)
      .do(async ctx => {
        let breakdown = await agentTrackingSpendService.getBreakdown({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          groupBy: ctx.query.group_by,
          range: rangeOf(ctx.query),
          filters: spendFiltersOf(ctx.query)
        });

        return agentTrackingSpendBreakdownPresenter.present({ breakdown });
      })
  }
);
