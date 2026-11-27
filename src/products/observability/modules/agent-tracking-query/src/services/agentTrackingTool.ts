import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization, Project } from '@metorial/db';
import { assertAgentTrackingEnabled } from '@metorial/module-agent-tracking-sync';
import { lookupMembers } from '../lib/members';
import { individualsHiddenError, loadVisibleSettings } from '../lib/privacy';
import {
  providerCallFiguresOf,
  providerCallItemsOf,
  providerCallKeysOf,
  providerCallsHiddenError,
  providerCallsQuery
} from '../lib/providerCalls';
import { lookupProviders, type ProviderReadScope } from '../lib/providers';
import { assertRecordRange } from '../lib/queries';
import {
  normalizeRange,
  rangeCacheKey,
  resolveRange,
  type NormalizedRange,
  type RangeInput,
  type ResolvedRange
} from '../lib/range';
import { lookupRepositories } from '../lib/repositories';
import { lookupSkills, type SkillReadScope } from '../lib/skills';
import {
  cachedRead,
  runUsageQueries,
  runUsageQuery,
  type ReadScope,
  type UsageResult
} from '../lib/scope';
import {
  anyDistinctCapped,
  anyTruncated,
  mcpServerItemsOf,
  mcpServerProvidersQuery,
  mcpServerUsageQuery,
  mcpSummaryOf,
  mcpToolUsageQuery,
  mcpSummaryQuery,
  serverProviderIdsOf,
  skillItemsOf,
  skillDevicesOf,
  skillDevicesQuery,
  skillSummaryOf,
  skillSummaryQuery,
  skillUsageQuery,
  toolsHiddenError
} from '../lib/tools';
import { failSoft, fromService } from '../lib/service';
import type {
  AgentTrackingMcpServerUsage,
  AgentTrackingMember,
  AgentTrackingProvider,
  AgentTrackingProviderCalls,
  AgentTrackingRepository,
  AgentTrackingSkill,
  AgentTrackingSkillUsage,
  ProviderCallGroup
} from '../lib/types';

let noRows: UsageResult = { rows: [] };

type ToolReadScope = ReadScope & { organization: Organization; project: Project };

class AgentTrackingToolServiceImpl {
  async getSkillUsage(
    d: ToolReadScope & SkillReadScope & { range: RangeInput }
  ): Promise<AgentTrackingSkillUsage> {
    let { range, now, toolDetails } = await this.prepare(d, {
      hiddenError: toolsHiddenError,
      label: 'Skill and MCP usage'
    });

    let usage = await cachedRead({
      scope: d,
      read: 'tools.skills',
      input: { range: rangeCacheKey(range, now), skillNames: !!d.canReadSkills },
      load: async () => {
        let resolved = resolveRange(range, now);
        let [results, installedSkills] = await Promise.all([
          runUsageQueries(d, [skillSummaryQuery(resolved), skillUsageQuery(resolved)]),
          this.installedSkills(d, resolved)
        ]);
        let [summary = noRows, skills = noRows] = results.map(result => result ?? noRows);

        return {
          range: resolved,
          summary: skillSummaryOf(summary, anyDistinctCapped([summary, skills])),
          items: skillItemsOf(skills, installedSkills),
          truncated: !!skills.meta?.truncated
        };
      }
    });

    return { ...usage, toolDetails };
  }

  async getMcpServerUsage(
    d: ToolReadScope & ProviderReadScope & { range: RangeInput }
  ): Promise<AgentTrackingMcpServerUsage> {
    let { range, now, toolDetails } = await this.prepare(d, {
      hiddenError: toolsHiddenError,
      label: 'Skill and MCP usage'
    });

    let usage = await cachedRead({
      scope: d,
      read: 'tools.mcpServers',
      input: { range: rangeCacheKey(range, now), providerNames: !!d.canReadProviders },
      load: async () => {
        let resolved = resolveRange(range, now);
        let [results, providers] = await Promise.all([
          runUsageQueries(d, [
            mcpSummaryQuery(resolved),
            mcpServerUsageQuery(resolved),
            mcpToolUsageQuery(resolved)
          ]),
          this.serverProviders(d, resolved)
        ]);
        let [summary = noRows, servers = noRows, tools = noRows] = results.map(
          result => result ?? noRows
        );

        return {
          range: resolved,
          summary: mcpSummaryOf(summary, anyDistinctCapped([summary, servers, tools])),
          items: mcpServerItemsOf({ servers, tools, providers }),
          truncated: anyTruncated([servers, tools])
        };
      }
    });

    return { ...usage, toolDetails };
  }

  async getProviderCalls(
    d: ToolReadScope & {
      range: RangeInput;
      groupBy: ProviderCallGroup;
      providerId?: string;
      toolKey?: string;
    }
  ): Promise<AgentTrackingProviderCalls> {
    let { range, now } = await this.prepare(d, {
      hiddenError: d.groupBy == 'member' ? individualsHiddenError : providerCallsHiddenError,
      label: 'Agent tool calls'
    });

    let providerId = d.providerId?.trim() || null;
    let toolKey = d.toolKey?.trim() || null;

    return await cachedRead({
      scope: d,
      read: 'tools.providerCalls',
      input: { range: rangeCacheKey(range, now), groupBy: d.groupBy, providerId, toolKey },
      load: async () => {
        let resolved = resolveRange(range, now);
        let result: UsageResult = await runUsageQuery(
          d,
          providerCallsQuery({ range: resolved, groupBy: d.groupBy, providerId, toolKey })
        );

        let keys = providerCallKeysOf(d.groupBy, result.rows);
        let labels = (result.labels?.user ?? {}) as Record<string, { name?: string | null }>;
        let [members, repositories] = await Promise.all([
          d.groupBy == 'member'
            ? lookupMembers({
                scope: d,
                ids: keys,
                names: new Map(keys.map(key => [key, labels[key]?.name ?? null]))
              })
            : new Map<string, AgentTrackingMember>(),
          d.groupBy == 'repository'
            ? lookupRepositories({ scope: d, ids: keys })
            : new Map<string, AgentTrackingRepository>()
        ]);

        return {
          range: resolved,
          groupBy: d.groupBy,
          providerId,
          toolKey,
          total: providerCallFiguresOf(result.totals),
          items: providerCallItemsOf({
            groupBy: d.groupBy,
            rows: result.rows,
            members,
            repositories
          })
        };
      }
    });
  }

  private async serverProviders(
    d: ReadScope & ProviderReadScope,
    range: ResolvedRange
  ): Promise<Map<string, AgentTrackingProvider>> {
    if (!d.canReadProviders) return new Map();

    return await failSoft(async () => {
      let stamped: UsageResult = await fromService(() =>
        runUsageQuery(d, mcpServerProvidersQuery(range))
      );
      let providerIds = serverProviderIdsOf(stamped);
      let found = await lookupProviders({ scope: d, ids: [...providerIds.values()] });

      return new Map(
        [...providerIds].flatMap(([server, id]) => {
          let provider = found.get(id);
          return provider ? [[server, provider] as const] : [];
        })
      );
    }, new Map<string, AgentTrackingProvider>());
  }

  private async installedSkills(
    d: ReadScope & SkillReadScope,
    range: ResolvedRange
  ): Promise<Map<string, AgentTrackingSkill>> {
    if (!d.canReadSkills) return new Map();

    return await failSoft(async () => {
      let devices: UsageResult = await fromService(() =>
        runUsageQuery(d, skillDevicesQuery(range))
      );

      return await lookupSkills({ scope: d, devicesByName: skillDevicesOf(devices) });
    }, new Map<string, AgentTrackingSkill>());
  }

  private async prepare(
    d: ToolReadScope & { range: RangeInput },
    opts: { hiddenError: ConstructorParameters<typeof ServiceError>[0]; label: string }
  ) {
    await assertAgentTrackingEnabled({ organization: d.organization, project: d.project });
    let { desktop } = await loadVisibleSettings(d, opts.hiddenError);

    let range: NormalizedRange = normalizeRange(d.range);
    let now = new Date();
    assertRecordRange(resolveRange(range, now), opts.label);

    return { range, now, toolDetails: desktop.toolDetails };
  }
}

export let agentTrackingToolService = Service.create(
  'agentTrackingToolService',
  () => new AgentTrackingToolServiceImpl()
).build();
