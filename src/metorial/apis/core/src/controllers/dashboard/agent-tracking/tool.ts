import { v } from '@lowerdeck/validation';
import {
  agentTrackingToolService,
  providerCallGroups,
  providerCallsLimit,
  requestRecordDays
} from '@metorial/module-agent-tracking-query';
import {
  agentTrackingMcpServerUsagePresenter,
  agentTrackingProviderCallsPresenter,
  agentTrackingSkillUsagePresenter
} from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { rangeOf } from '../../../lib/agentTrackingParams';
import { canReadProviders } from '../../../lib/toolCallAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  agentTrackingBasePath,
  agentTrackingReadGroup,
  rangeQueryFieldsFor
} from './readGroup';

let privacyNote = 'Refused when the organization hides individual data.';

export let dashboardAgentTrackingToolController = Controller.create(
  {
    name: 'Agent Tracking Tools',
    description:
      'Agent tracking tools are the skills and MCP servers AI coding agents used, as their telemetry reports them. Claude Code sends custom skill and MCP server names only with Detailed Tool Reporting on.',
    hideInDocs: true
  },
  {
    skills: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/tools/skills`,
          'dashboard.instance.agentTracking.tools.skills'
        ),
        {
          name: 'Get skill usage',
          description: `Returns how often each skill was activated over a range and by how many members, with the totals of the range. ${privacyNote} Results can be up to a minute old.`,
          hideInDocs: true
        }
      )
      .query('default', v.object(rangeQueryFieldsFor(requestRecordDays)))
      .output(agentTrackingSkillUsagePresenter)
      .do(async ctx => {
        let usage = await agentTrackingToolService.getSkillUsage({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          range: rangeOf(ctx.query)
        });

        return agentTrackingSkillUsagePresenter.present({ usage });
      }),

    mcpServers: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/tools/mcp-servers`,
          'dashboard.instance.agentTracking.tools.mcpServers'
        ),
        {
          name: 'Get MCP server usage',
          description: `Returns the calls, failures and members of each MCP server and its tools over a range, with the totals of the range. ${privacyNote} Results can be up to a minute old.`,
          hideInDocs: true
        }
      )
      .query('default', v.object(rangeQueryFieldsFor(requestRecordDays)))
      .output(agentTrackingMcpServerUsagePresenter)
      .do(async ctx => {
        let usage = await agentTrackingToolService.getMcpServerUsage({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          canReadProviders: await canReadProviders(ctx),
          range: rangeOf(ctx.query)
        });

        return agentTrackingMcpServerUsagePresenter.present({ usage });
      }),

    providerCalls: agentTrackingReadGroup
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .get(
        Path(
          `${agentTrackingBasePath}/tools/provider-calls`,
          'dashboard.instance.agentTracking.tools.providerCalls'
        ),
        {
          name: 'Get agent provider calls',
          description: `Returns the MCP tool calls of Claude Code and Codex that reached Metorial providers over a range, with failures, by repository, member or client. ${privacyNote}`,
          hideInDocs: true
        }
      )
      .query(
        'default',
        v.object({
          group_by: v.enumOf(providerCallGroups, {
            name: 'group_by',
            description: `What to group the calls by. The ${providerCallsLimit} groups with the most calls are listed.`
          }),
          provider_id: v.optional(
            v.string({
              name: 'provider_id',
              description: 'Only count calls that reached this provider.',
              examples: ['pro_0mhNnEqM7XQb3vXq8gD2'],
              modifiers: [v.maxLength(200)]
            })
          ),
          tool_key: v.optional(
            v.string({
              name: 'tool_key',
              description:
                'Only count calls of the tool with this key. Calls recorded without their tool, such as while Detailed Tool Reporting is off, never match.',
              examples: ['create_issue'],
              modifiers: [v.maxLength(200)]
            })
          ),
          ...rangeQueryFieldsFor(requestRecordDays)
        })
      )
      .output(agentTrackingProviderCallsPresenter)
      .do(async ctx => {
        let providerCalls = await agentTrackingToolService.getProviderCalls({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          groupBy: ctx.query.group_by,
          providerId: ctx.query.provider_id,
          toolKey: ctx.query.tool_key,
          range: rangeOf(ctx.query)
        });

        return agentTrackingProviderCallsPresenter.present({ providerCalls });
      })
  }
);
