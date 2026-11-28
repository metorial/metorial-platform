import { v } from '@lowerdeck/validation';
import { maxToolCallLinks, toolCallLinkService } from '@mtsrc/agent-tracking-module-sessions';
import { instanceApp } from './_app';

let nonEmpty = () => v.string({ modifiers: [v.minLength(1)] });

export let upsertToolCallLinksInput = v.object({
  organizationId: v.string(),
  instanceId: v.string(),
  links: v.array(
    v.object({
      clientFamily: nonEmpty(),
      toolCallId: nonEmpty(),
      calledAt: v.date(),
      metorial: v.object({
        toolCallId: nonEmpty(),
        providerId: nonEmpty(),
        toolKey: v.optional(nonEmpty()),
        deploymentId: v.optional(nonEmpty()),
        integrationId: v.optional(nonEmpty()),
        magicMcpServerId: v.optional(nonEmpty())
      })
    }),
    { modifiers: [v.maxLength(maxToolCallLinks)] }
  )
});

export let toolCallLinkController = instanceApp.controller({
  upsert: instanceApp
    .handler()
    .input(upsertToolCallLinksInput)
    .do(async ctx => {
      let result = await toolCallLinkService.upsertToolCallLinks({
        organization: ctx.organization,
        instance: ctx.instance,
        links: ctx.input.links
      });

      return {
        object: 'agent_tracking#tool_call_links',
        written: result.written,
        sessionsSettling: result.sessionKeys.length
      };
    })
});
