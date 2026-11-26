import { v } from '@lowerdeck/validation';
import {
  agentTrackingSpendService,
  breakdownGroupKeys,
  growthRateBounds
} from '@metorial/module-agent-tracking-query';
import {
  agentTrackingSpendBreakdownPresenter,
  agentTrackingSpendReportPresenter,
  agentTrackingSpendTimelinePresenter
} from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { idFilter, rangeOf, timeZoneField } from '../../../lib/agentTrackingParams';
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
    description:
      'What AI coding agents cost, over time and by member, model, repository, branch or ticket.',
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
            'Returns the cost of the instance over a range by member, model, repository, branch or ticket: the top 10 with their share of the total, then everything else as one item. Results can be up to a minute old.',
          hideInDocs: true
        }
      )
      .query(
        'default',
        v.object({
          group_by: v.enumOf(breakdownGroupKeys, {
            name: 'group_by',
            description:
              'Group the cost by `member`, `model`, `repository`, `branch` or `ticket`. A session with several repositories or tickets counts fully in each, so those groups are not shares of one total.'
          }),
          ...rangeQueryFields,
          ...spendFilterFields,
          member_id: idFilter(
            'member_id',
            'Only count usage of these members, such as one member broken down by model. `unknown` selects usage without a member (Unknown Member). Refused when the organization hides individual data.',
            ['aten_0mhNnEqM7XQb3vXq8gD2']
          )
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
          filters: {
            ...spendFiltersOf(ctx.query),
            memberIds: normalizeArrayParam(ctx.query.member_id)
          }
        });

        return agentTrackingSpendBreakdownPresenter.present({ breakdown });
      }),

    report: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/spend/report`,
          'dashboard.instance.agentTracking.spend.report'
        ),
        {
          name: 'Get spend report',
          description:
            'Returns the cost of the instance over one calendar year: per month, by model, AI coding agent and member, how far the data reaches, and for the current year a projection to its end and through the next year. Results can be up to a minute old.',
          hideInDocs: true
        }
      )
      .query(
        'default',
        v.object({
          year: v.optional(
            v.number({
              name: 'year',
              description:
                'The calendar year in `time_zone`: the current year or the one before. Defaults to the current year.',
              examples: [2026],
              modifiers: [v.integer()]
            })
          ),
          growth_rate: v.optional(
            v.number({
              name: 'growth_rate',
              description: `The monthly growth of the projection's growth scenario, as a fraction from ${growthRateBounds.input.min} to ${growthRateBounds.input.max}. Defaults to the observed growth, else \`0\`.`,
              examples: [0.05],
              modifiers: [
                v.minValue(growthRateBounds.input.min),
                v.maxValue(growthRateBounds.input.max)
              ]
            })
          ),
          time_zone: timeZoneField(
            'The IANA time zone months and days are counted in. Defaults to UTC. Ignored when the organization hides individual data: days are then UTC days.'
          )
        })
      )
      .output(agentTrackingSpendReportPresenter)
      .do(async ctx => {
        let report = await agentTrackingSpendService.getReport({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          year: ctx.query.year,
          growthRate: ctx.query.growth_rate,
          timeZone: ctx.query.time_zone
        });

        return agentTrackingSpendReportPresenter.present({ report });
      })
  }
);
