import { v } from '@lowerdeck/validation';
import { sessionPresenter } from '../presenters';
import { maxSessionPageSize, sessionService, sessionStates } from '../services';
import { organizationApp } from './_app';
import { sessionAttributionRoutes } from './sessionAttribution';
import { sessionClassificationRoutes } from './sessionClassification';

let idsSchema = v.optional(v.array(v.string()));

export let sessionRoutes = {
  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), sessionKey: v.string() }))
    .do(async ctx => {
      let session = await sessionService.getSession({
        organization: ctx.organization,
        sessionKey: ctx.input.sessionKey
      });

      return sessionPresenter(session);
    }),

  list: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        projectIds: idsSchema,
        instanceIds: idsSchema,
        userIds: idsSchema,
        deviceIds: idsSchema,
        agentIds: idsSchema,
        states: v.optional(v.array(v.enumOf(sessionStates))),
        from: v.optional(v.date()),
        to: v.optional(v.date()),

        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(maxSessionPageSize)] })
        ),
        cursor: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let page = await sessionService.listSessions({
        organization: ctx.organization,
        filters: {
          projectIds: ctx.input.projectIds,
          instanceIds: ctx.input.instanceIds,
          userIds: ctx.input.userIds,
          deviceIds: ctx.input.deviceIds,
          agentIds: ctx.input.agentIds,
          states: ctx.input.states,
          from: ctx.input.from,
          to: ctx.input.to
        },
        limit: ctx.input.limit,
        cursor: ctx.input.cursor
      });

      return {
        object: 'list',
        items: page.items.map(sessionPresenter),
        pagination: { hasMore: page.hasMore, nextCursor: page.nextCursor }
      };
    })
};

export let sessionController = organizationApp.controller({
  ...sessionRoutes,
  ...sessionAttributionRoutes,
  ...sessionClassificationRoutes
});
