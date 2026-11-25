import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { agentTrackingSettingsService } from '@metorial/module-agent-tracking-sync';
import { assertRecordRange } from '../lib/queries';
import {
  normalizeRange,
  rangeCacheKey,
  resolveRange,
  type NormalizedRange,
  type RangeInput
} from '../lib/range';
import { cachedRead, runUsageQueries, type ReadScope, type UsageResult } from '../lib/scope';
import {
  anyDistinctCapped,
  anyTruncated,
  mcpServerItemsOf,
  mcpServerUsageQuery,
  mcpSummaryOf,
  mcpToolUsageQuery,
  mcpSummaryQuery,
  skillItemsOf,
  skillSummaryOf,
  skillSummaryQuery,
  skillUsageQuery,
  toolsHiddenError
} from '../lib/tools';
import type { AgentTrackingMcpServerUsage, AgentTrackingSkillUsage } from '../lib/types';

let noRows: UsageResult = { rows: [] };

class AgentTrackingToolServiceImpl {
  async getSkillUsage(d: ReadScope & { range: RangeInput }): Promise<AgentTrackingSkillUsage> {
    let { range, now, toolDetails } = await this.prepare(d);

    let usage = await cachedRead({
      scope: d,
      read: 'tools.skills',
      input: { range: rangeCacheKey(range, now) },
      load: async () => {
        let resolved = resolveRange(range, now);
        let [summary = noRows, skills = noRows] = (
          await runUsageQueries(d, [skillSummaryQuery(resolved), skillUsageQuery(resolved)])
        ).map(result => result ?? noRows);

        return {
          range: resolved,
          summary: skillSummaryOf(summary, anyDistinctCapped([summary, skills])),
          items: skillItemsOf(skills),
          truncated: !!skills.meta?.truncated
        };
      }
    });

    return { ...usage, toolDetails };
  }

  async getMcpServerUsage(
    d: ReadScope & { range: RangeInput }
  ): Promise<AgentTrackingMcpServerUsage> {
    let { range, now, toolDetails } = await this.prepare(d);

    let usage = await cachedRead({
      scope: d,
      read: 'tools.mcpServers',
      input: { range: rangeCacheKey(range, now) },
      load: async () => {
        let resolved = resolveRange(range, now);
        let [summary = noRows, servers = noRows, tools = noRows] = (
          await runUsageQueries(d, [
            mcpSummaryQuery(resolved),
            mcpServerUsageQuery(resolved),
            mcpToolUsageQuery(resolved)
          ])
        ).map(result => result ?? noRows);

        return {
          range: resolved,
          summary: mcpSummaryOf(summary, anyDistinctCapped([summary, servers, tools])),
          items: mcpServerItemsOf({ servers, tools }),
          truncated: anyTruncated([servers, tools])
        };
      }
    });

    return { ...usage, toolDetails };
  }

  private async prepare(d: ReadScope & { range: RangeInput }) {
    let { privacy, desktop } = await agentTrackingSettingsService.getOrganizationValues({
      organization: d.organization
    });
    if (privacy.hideIndividuals) throw new ServiceError(toolsHiddenError);

    let range: NormalizedRange = normalizeRange(d.range);
    let now = new Date();
    assertRecordRange(resolveRange(range, now), 'Skill and MCP usage');

    return { range, now, toolDetails: desktop.toolDetails };
  }
}

export let agentTrackingToolService = Service.create(
  'agentTrackingToolService',
  () => new AgentTrackingToolServiceImpl()
).build();
