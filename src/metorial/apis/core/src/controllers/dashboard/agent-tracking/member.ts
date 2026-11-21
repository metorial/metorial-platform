import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  agentTrackingMemberService,
  maxRangeDays,
  memberWindowDays
} from '@metorial/module-agent-tracking-query';
import { agentTrackingMemberPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { idFilter, rangeFields, rangeOf } from '../../../lib/agentTrackingParams';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { agentTrackingBasePath, agentTrackingReadGroup } from './readGroup';

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
      })
  }
);
