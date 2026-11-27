import { agentTrackingSessionService } from '@metorial/module-agent-tracking-query';
import { agentTrackingSessionToolCallsPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { getOwnershipActor } from '../../../lib/ownershipActor';
import { requireParam } from '../../../lib/requireParam';
import { canReadToolCalls } from '../../../lib/toolCallAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { agentTrackingInstanceGroup } from './group';

export let agentTrackingSessionToolCallController = Controller.create(
  {
    name: 'Agent Tracking Session Tool Calls',
    description:
      'Agent session tool calls are the MCP tool calls an AI coding agent made in an agent session that went through Metorial, each matched to the tool call Metorial recorded.',
    hideInDocs: true
  },
  {
    list: agentTrackingInstanceGroup
      .get(
        instancePath(
          'agent-tracking/sessions/:sessionId/tool-calls',
          'agentTracking.sessions.toolCalls.list'
        ),
        {
          name: 'List agent session tool calls',
          description:
            'Returns the Metorial tool calls you can see that an agent session made, oldest first, and how many of its MCP tool calls are not linked to one. Refused when the organization hides individual data.',
          hideInDocs: true
        }
      )
      .output(agentTrackingSessionToolCallsPresenter)
      .do(async ctx => {
        let toolCalls = await agentTrackingSessionService.listSessionToolCalls({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          canReadToolCalls: await canReadToolCalls(ctx),
          sessionId: requireParam(ctx.params, 'sessionId')
        });

        return agentTrackingSessionToolCallsPresenter.present({ toolCalls });
      })
  }
);
