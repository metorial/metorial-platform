import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  agentTrackingSessionService,
  maxRangeDays,
  nameFilterValueValidator,
  sessionListOrderBys,
  ticketFilterValueValidator
} from '@metorial/module-agent-tracking-query';
import {
  agentTrackingSessionDetailPresenter,
  agentTrackingSessionPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { idFilter, rangeFields, rangeOf } from '../../../lib/agentTrackingParams';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { requireParam } from '../../../lib/requireParam';
import { instancePath } from '../../../middleware/instanceGroup';
import { agentTrackingInstanceGroup } from './group';

let sessionRangeFields = rangeFields({
  range:
    'Only return sessions last active in this calendar range of time_zone: today, last_7_days and last_30_days (today and the days before it), month_to_date, or last_month. Ranges that include today end now. Leave out with from and to. Without range, from and to, sessions of any time are returned.',
  from: `Only return sessions last active at or after this time. Needs to. At most ${maxRangeDays} days before to.`,
  to: 'Only return sessions last active before this time. Needs from.',
  timeZone: 'The IANA time zone range is resolved in. Defaults to UTC.'
});

export let agentTrackingSessionController = Controller.create(
  {
    name: 'Agent Tracking Sessions',
    description: 'The sessions of AI coding agents, with what each one cost.',
    hideInDocs: true
  },
  {
    list: agentTrackingInstanceGroup
      .get(instancePath('agent-tracking/sessions', 'agentTracking.sessions.list'), {
        name: 'List agent sessions',
        description:
          'Returns the sessions of the instance, most recently active first, or most expensive first with order_by=cost. Results can be up to 30 seconds old.',
        hideInDocs: true
      })
      .query(
        'default',
        Paginator.validate(
          v.object({
            member_id: idFilter(
              'member_id',
              'Only return sessions of these members. unknown selects sessions without a member (Unknown Member).',
              ['aten_0mhNnEqM7XQb3vXq8gD2', 'unknown']
            ),
            model_id: idFilter(
              'model_id',
              'Only return sessions that used these models. unknown selects sessions that used a model not matched to the model catalog (Unknown Model). Models are recorded when a session settles, so a session joins a model filter about 30 seconds after its first request to that model.',
              ['claude-sonnet-4-5', 'unknown']
            ),
            client_family: idFilter(
              'client_family',
              'Only return sessions of these AI coding agents, by client family as in client.family.',
              ['claude_code']
            ),
            repository_id: idFilter(
              'repository_id',
              'Only return sessions that ran in one of these repositories, by `context.repositories[].id`.',
              ['aten_0mhNnEqM7XQb3vXq8gD2']
            ),
            branch: idFilter(
              'branch',
              'Only return sessions on one of these Git branches, by exact name.',
              ['main'],
              nameFilterValueValidator
            ),
            ticket: idFilter(
              'ticket',
              'Only return sessions that worked on one of these tickets, by `context.tickets[].key` in any case. Issue numbers such as `#42` are refused.',
              ['ENG-123'],
              ticketFilterValueValidator
            ),
            pull_request: idFilter(
              'pull_request',
              'Only return sessions that opened or linked one of these pull requests, by `context.pull_requests[].key`. Matches the pull requests recorded on the session, at most 20.',
              ['github.com/acme/api#7'],
              nameFilterValueValidator
            ),
            order_by: v.optional(
              v.enumOf(sessionListOrderBys, {
                name: 'order_by',
                description:
                  'last_activity (the default) lists sessions by when they were last active; cost lists them by cost.total_micros, sessions without a known cost last. order sets the direction of either, newest or most expensive first by default. Pass a range with cost: without one, each page reads every session of the instance.'
              })
            ),
            ...sessionRangeFields
          })
        )
      )
      .outputList(agentTrackingSessionPresenter)
      .do(async ctx => {
        let paginator = await agentTrackingSessionService.listSessions({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          memberIds: normalizeArrayParam(ctx.query.member_id),
          modelIds: normalizeArrayParam(ctx.query.model_id),
          clientFamilies: normalizeArrayParam(ctx.query.client_family),
          repositoryIds: normalizeArrayParam(ctx.query.repository_id),
          branches: normalizeArrayParam(ctx.query.branch),
          tickets: normalizeArrayParam(ctx.query.ticket),
          pullRequests: normalizeArrayParam(ctx.query.pull_request),
          orderBy: ctx.query.order_by,
          range: rangeOf(ctx.query)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, session =>
          agentTrackingSessionPresenter.present({ session })
        );
      }),

    get: agentTrackingInstanceGroup
      .get(instancePath('agent-tracking/sessions/:sessionId', 'agentTracking.sessions.get'), {
        name: 'Get agent session',
        description:
          'Returns one session of the instance with its requests, tokens and cost per model and its commits. Results can be up to 30 seconds old.',
        hideInDocs: true
      })
      .output(agentTrackingSessionDetailPresenter)
      .do(async ctx => {
        let session = await agentTrackingSessionService.getSession({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          sessionId: requireParam(ctx.params, 'sessionId')
        });

        return agentTrackingSessionDetailPresenter.present({ session });
      })
  }
);
