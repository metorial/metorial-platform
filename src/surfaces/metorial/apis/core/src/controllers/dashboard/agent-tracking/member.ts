import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  agentTrackingMemberInsightService,
  agentTrackingMemberService,
  maxInsightMembers,
  maxRangeDays,
  memberInsightsGroups,
  memberInsightsParamFields,
  memberWindowDays,
  requestRecordDays
} from '@metorial/module-agent-tracking-query';
import {
  agentTrackingMemberInsightsPresenter,
  agentTrackingMemberPresenter
} from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { idFilter, rangeFields, rangeOf } from '../../../lib/agentTrackingParams';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { agentTrackingBasePath, agentTrackingReadGroup, rangeQueryFields } from './readGroup';

let memberRangeFields = rangeFields({
  range: `Only count sessions last active in this calendar range of time_zone: today, last_7_days and last_30_days (today and the days before it), month_to_date, or last_month. Ranges that include today end now. Leave out with from and to. Without range, from and to, the sessions of the last ${memberWindowDays} days are counted.`,
  from: `Only count sessions last active at or after this time. Needs to. At most ${maxRangeDays} days before to.`,
  to: 'Only count sessions last active before this time. Needs from.',
  timeZone: 'The IANA time zone range is resolved in. Defaults to UTC.'
});

export let dashboardAgentTrackingMemberController = Controller.create(
  {
    name: 'Agent Tracking Members',
    description: 'The people who have sent usage from AI coding agents.',
    hideInDocs: true
  },
  {
    list: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/members`,
          'dashboard.instance.agentTracking.members.list'
        ),
        {
          name: 'List members seen',
          description: `Returns the members with sessions in this instance last active in the range (the last ${memberWindowDays} days without one), most recently active first, with whether each matched a Metorial member and the sessions and cost of those sessions. Pages by item id. Results can be up to a minute old.`,
          hideInDocs: true
        }
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            member_id: idFilter('member_id', 'Only return these members.', [
              'aten_0mhNnEqM7XQb3vXq8gD2'
            ]),
            ...memberRangeFields
          })
        )
      )
      .outputList(agentTrackingMemberPresenter)
      .do(async ctx => {
        let { list, truncated } = await agentTrackingMemberService.listMembers({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          memberIds: normalizeArrayParam(ctx.query.member_id),
          range: rangeOf(ctx.query),
          page: ctx.query
        });

        return Paginator.present(list, member =>
          agentTrackingMemberPresenter.present({ member, listTruncated: truncated })
        );
      }),

    insights: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/members/insights`,
          'dashboard.instance.agentTracking.members.insights'
        ),
        {
          name: 'List member insights',
          description: `Returns the members of this instance ranked over a range by cost or another figure, with optional model usage, practices and seat columns, flags for the thresholds passed, and instance totals. Ranks at most ${maxInsightMembers} members. Practices and seat need a range of at most ${requestRecordDays} days. Pages by item id. Results can be up to a minute old.`,
          hideInDocs: true
        }
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            ...rangeQueryFields,
            include: v.optional(
              v.union(
                [v.enumOf(memberInsightsGroups), v.array(v.enumOf(memberInsightsGroups))],
                {
                  name: 'include',
                  description:
                    'Column groups to compute besides cost, share, sessions, requests and last activity: `models` (usage of the models in `model_id`), `practices` (reasoning effort, speed tier, outdated models, prompt cache) and `seat` (reported seat and plan, usage at list prices). A sort, threshold or filter of a group needs the group here.',
                  examples: [['practices', 'seat']]
                }
              )
            ),
            model_id: idFilter(
              'model_id',
              'The models the `models` group measures. Required with `include=models`, refused without it. `unknown` selects usage whose model is not matched to the model catalog.',
              ['claude-sonnet-4-5', 'unknown']
            ),
            seat: idFilter(
              'seat',
              'Only list members whose reported seat type is one of these, as filter values lists them for `field=seat`. Members whose seat is not known are left out. `rank`, `summary.members`, `summary.flag_counts` and `summary.seat` then cover only these members; the instance totals do not change. Needs `include=seat`.',
              ['premium']
            ),
            ...memberInsightsParamFields
          })
        )
      )
      .output(agentTrackingMemberInsightsPresenter)
      .do(async ctx => {
        let insights = await agentTrackingMemberInsightService.listMemberInsights({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          range: rangeOf(ctx.query),
          include: normalizeArrayParam(ctx.query.include),
          modelIds: normalizeArrayParam(ctx.query.model_id),
          seats: normalizeArrayParam(ctx.query.seat),
          includeInactive: ctx.query.include_inactive,
          sort: ctx.query.sort,
          thresholds: {
            modelShareMin: ctx.query.model_share_min,
            highEffortShareMin: ctx.query.high_effort_share_min,
            fastShareMin: ctx.query.fast_share_min,
            outdatedShareMin: ctx.query.outdated_share_min,
            cacheHitRateMax: ctx.query.cache_hit_rate_max,
            seatUsageMaxMicros: ctx.query.seat_usage_max_micros
          },
          flaggedOnly: ctx.query.flagged_only,
          page: ctx.query
        });

        return agentTrackingMemberInsightsPresenter.present({ insights });
      })
  }
);
