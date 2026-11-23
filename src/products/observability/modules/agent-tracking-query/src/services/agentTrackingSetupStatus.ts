import { Service } from '@lowerdeck/service';
import { requireAgentTracking } from '@metorial/module-agent-tracking-sync';
import { countOf } from '../lib/money';
import {
  evidenceWindowDays,
  setupClientFamily,
  setupSessionsQuery,
  toolDetailsQuery
} from '../lib/queries';
import { cachedRead, runUsageQuery, type ReadScope } from '../lib/scope';
import { queryCallOptions, readCallOptions } from '../lib/service';
import type {
  AgentTrackingSetupStatus,
  SetupOptionKey,
  SetupOptionStatus
} from '../lib/types';

let dayMs = 24 * 60 * 60 * 1000;

let maxIngestSources = 100;

let detected = (proven: boolean): SetupOptionStatus => (proven ? 'detected' : 'not_detected');

let latest = (dates: (Date | string | null | undefined)[]): Date | null =>
  dates
    .filter((date): date is Date | string => !!date)
    .map(date => new Date(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

class AgentTrackingSetupStatusServiceImpl {
  async getSetupStatus(d: ReadScope): Promise<AgentTrackingSetupStatus> {
    return await cachedRead({
      scope: d,
      read: 'setupStatus.get',
      load: async () => {
        let now = new Date();
        let window = { from: new Date(now.getTime() - evidenceWindowDays * dayMs), to: now };

        let agentTracking = requireAgentTracking();

        let [ingestSources, coverage, sessions, toolCalls] = await Promise.all([
          agentTracking.ingestSource.list(
            {
              organizationId: d.organization.id,
              instanceId: d.instance.id,
              limit: maxIngestSources
            },
            readCallOptions
          ),
          agentTracking.coverage.get(
            {
              organizationId: d.organization.id,
              scope: { instanceIds: [d.instance.id] },
              range: window
            },
            queryCallOptions
          ),
          runUsageQuery(d, setupSessionsQuery(window)),
          runUsageQuery(d, toolDetailsQuery(window))
        ]);

        let hookSeen = coverage.sources.some(source => {
          let at = source.lastSeen.hook;
          return source.family == setupClientFamily && !!at && new Date(at) >= window.from;
        });
        let sessionCounts = sessions.rows[0] ?? {};
        let withDetails = countOf(toolCalls.rows[0]?.tool_calls_with_details);

        let options: Record<SetupOptionKey, SetupOptionStatus> = {
          usageAndCost: detected(countOf(sessionCounts.sessions_with_usage) > 0),
          keepLocalHistory: 'undetectable',
          repository: detected(countOf(sessionCounts.sessions_with_repo) > 0),
          toolDetails: detected(withDetails > 0),
          hooks: detected(hookSeen)
        };

        return {
          lastReceivedAt: latest([
            ...ingestSources.items.map(source => source.lastUsedAt),
            ...coverage.sources.map(source => source.lastSeenAt)
          ]),
          options
        };
      }
    });
  }
}

export let agentTrackingSetupStatusService = Service.create(
  'agentTrackingSetupStatusService',
  () => new AgentTrackingSetupStatusServiceImpl()
).build();
