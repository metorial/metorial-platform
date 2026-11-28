import { v } from '@lowerdeck/validation';
import {
  maxToolCallLookups,
  sessionToolCallService
} from '@mtsrc/agent-tracking-module-sessions';
import { instanceApp, organizationApp } from './_app';
import { sessionPresenter, sessionTitlesShown } from './presenters/session';
import {
  sessionMcpToolCallPresenter,
  toolCallRefPresenter,
  toolCallSessionPresenter
} from './presenters/sessionToolCall';

let nonEmpty = () => v.string({ modifiers: [v.minLength(1)] });

export let listMcpToolCallsInput = v.object({
  organizationId: v.string(),
  sessionKey: v.string()
});

export let findByToolCallsInput = v.object({
  organizationId: v.string(),
  instanceId: v.string(),
  toolCalls: v.array(v.object({ clientFamily: nonEmpty(), toolCallId: nonEmpty() }), {
    modifiers: [v.maxLength(maxToolCallLookups)]
  })
});

export let sessionToolCallRoutes = {
  listMcpToolCalls: organizationApp
    .handler()
    .input(listMcpToolCallsInput)
    .do(async ctx => {
      let result = await sessionToolCallService.listSessionMcpToolCalls({
        organization: ctx.organization,
        sessionKey: ctx.input.sessionKey
      });

      return {
        object: 'list',
        sessionKey: result.session._id,
        instanceId: result.session.instanceId,
        items: result.items.map(sessionMcpToolCallPresenter),
        hasMore: result.hasMore
      };
    }),

  findByToolCalls: instanceApp
    .handler()
    .input(findByToolCallsInput)
    .do(async ctx => {
      let result = await sessionToolCallService.findSessionsForToolCalls({
        organization: ctx.organization,
        instance: ctx.instance,
        calls: ctx.input.toolCalls
      });

      let titles = sessionTitlesShown(ctx.organization);

      return {
        object: 'list',
        items: result.items.map(toolCallSessionPresenter),
        ambiguous: result.ambiguous.map(toolCallRefPresenter),
        sessions: result.sessions.map(session => sessionPresenter({ session, titles }))
      };
    })
};
