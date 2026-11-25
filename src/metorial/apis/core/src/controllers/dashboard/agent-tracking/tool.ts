import { v } from '@lowerdeck/validation';
import {
  agentTrackingToolService,
  requestRecordDays
} from '@metorial/module-agent-tracking-query';
import {
  agentTrackingMcpServerUsagePresenter,
  agentTrackingSkillUsagePresenter
} from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { rangeOf } from '../../../lib/agentTrackingParams';
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
          range: rangeOf(ctx.query)
        });

        return agentTrackingMcpServerUsagePresenter.present({ usage });
      })
  }
);
