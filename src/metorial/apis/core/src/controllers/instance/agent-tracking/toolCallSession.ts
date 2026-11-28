import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  agentTrackingSessionService,
  maxToolCallSessionLookups
} from '@metorial/module-agent-tracking-query';
import { agentTrackingToolCallSessionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { getOwnershipActor } from '../../../lib/ownershipActor';
import { instancePath } from '../../../middleware/instanceGroup';
import { agentTrackingInstanceGroup } from './group';

export let agentTrackingToolCallSessionController = Controller.create(
  {
    name: 'Agent Tracking Tool Call Sessions',
    description:
      'A tool call session links a tool call to the agent session of the AI coding agent that made it.',
    hideInDocs: true
  },
  {
    list: agentTrackingInstanceGroup
      .get(
        instancePath(
          'agent-tracking/tool-call-sessions',
          'agentTracking.toolCallSessions.list'
        ),
        {
          name: 'List tool call sessions',
          description:
            'Returns the agent session of each of the given tool calls, in the order given. Tool calls without a known agent session are left out. Refused when the organization hides individual data.',
          hideInDocs: true
        }
      )
      .query(
        'default',
        v.object({
          tool_call_id: v.union(
            [
              v.string(),
              v.array(v.string(), { modifiers: [v.maxLength(maxToolCallSessionLookups)] })
            ],
            {
              name: 'tool_call_id',
              description: `Tool calls to find the agent sessions of, at most ${maxToolCallSessionLookups}.`,
              examples: ['tcl_8hJkLmNpQrStUvWx']
            }
          )
        })
      )
      .outputList(agentTrackingToolCallSessionPresenter)
      .do(async ctx => {
        let toolCallSessions = await agentTrackingSessionService.listToolCallSessions({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          canReadToolCalls: await ctx.integrationsAccess.toolCalls(),
          canReadProviders: await ctx.integrationsAccess.providers(),
          toolCallIds: normalizeArrayParam(ctx.query.tool_call_id) ?? []
        });

        return Paginator.present(
          {
            items: toolCallSessions,
            pagination: { hasNextPage: false, hasPreviousPage: false }
          },
          toolCallSession => agentTrackingToolCallSessionPresenter.present({ toolCallSession })
        );
      })
  }
);
