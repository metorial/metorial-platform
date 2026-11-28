import { v } from '@lowerdeck/validation';
import { sessionPresenter, sessionTitlesShown } from './presenters/session';
import {
  maxSessionPageSize,
  sessionListOrders,
  sessionListSorts,
  sessionService,
  sessionStates
} from '@mtsrc/agent-tracking-module-sessions';
import { organizationApp } from './_app';
import { sessionAttributionRoutes } from './sessionAttribution';
import { sessionClassificationRoutes } from './sessionClassification';
import { sessionToolCallRoutes } from './sessionToolCalls';

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

      return sessionPresenter({ session, titles: sessionTitlesShown(ctx.organization) });
    }),

  list: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        projectIds: idsSchema,
        instanceIds: idsSchema,
        userIds: v.optional(v.array(v.nullable(v.string()))),
        deviceIds: idsSchema,
        agentIds: idsSchema,
        modelIds: v.optional(v.array(v.nullable(v.string()))),
        clientFamilies: idsSchema,
        repoIds: idsSchema,
        branches: idsSchema,
        ticketRefs: idsSchema,
        pullRequests: idsSchema,
        metorialProviderIds: idsSchema,
        states: v.optional(v.array(v.enumOf(sessionStates))),
        from: v.optional(v.date()),
        to: v.optional(v.date()),
        lastActivityFrom: v.optional(v.date()),
        lastActivityTo: v.optional(v.date()),

        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(maxSessionPageSize)] })
        ),
        order: v.optional(v.enumOf(sessionListOrders)),
        orderBy: v.optional(v.enumOf(sessionListSorts)),
        after: v.optional(v.string()),
        before: v.optional(v.string())
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
          modelIds: ctx.input.modelIds,
          clientFamilies: ctx.input.clientFamilies,
          repoIds: ctx.input.repoIds,
          branches: ctx.input.branches,
          ticketRefs: ctx.input.ticketRefs,
          pullRequests: ctx.input.pullRequests,
          metorialProviderIds: ctx.input.metorialProviderIds,
          states: ctx.input.states,
          from: ctx.input.from,
          to: ctx.input.to,
          lastActivityFrom: ctx.input.lastActivityFrom,
          lastActivityTo: ctx.input.lastActivityTo
        },
        limit: ctx.input.limit,
        order: ctx.input.order,
        orderBy: ctx.input.orderBy,
        after: ctx.input.after,
        before: ctx.input.before
      });

      let titles = sessionTitlesShown(ctx.organization);

      return {
        object: 'list',
        items: page.items.map(session => sessionPresenter({ session, titles })),
        pagination: {
          hasMoreAfter: page.hasMoreAfter,
          hasMoreBefore: page.hasMoreBefore,
          ...(page.after ? { after: page.after } : {}),
          ...(page.before ? { before: page.before } : {})
        }
      };
    })
};

export let sessionController = organizationApp.controller({
  ...sessionRoutes,
  ...sessionAttributionRoutes,
  ...sessionClassificationRoutes,
  ...sessionToolCallRoutes
});
