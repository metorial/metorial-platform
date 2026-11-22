import { Service } from '@lowerdeck/service';
import type { Instance, Organization, Project } from '@metorial/db';
import { isAgentTrackingEnabledForOrganization } from '@metorial/module-agent-tracking-sync';
import { resolveConsumerRefs, unique } from '../lib/members';
import { loadPrivacy } from '../lib/privacy';
import {
  agentActiveWindowDays,
  agentActivityLookbackDays,
  agentActivityQuery
} from '../lib/queries';
import { cachedRead, runUsageQuery } from '../lib/scope';
import { fromService } from '../lib/service';

let dayMs = 24 * 60 * 60 * 1000;

let minuteMs = 60 * 1000;

type ActivityScope = {
  organization: Organization;
  project: Project;
  instance: Pick<Instance, 'oid' | 'id' | 'name'>;
};

type ActivityRow = { agentKey: string; memberId: string | null; lastUsedAt: string };

export let consumerAgentKey = (consumerId: string, agentKey: string) =>
  `${consumerId}:${agentKey}`;

let latest = (map: Map<string, Date>, key: string, date: Date) => {
  let current = map.get(key);
  if (!current || current < date) map.set(key, date);
};

class AgentTrackingAgentActivityServiceImpl {
  // `null` means agent tracking is off or cannot answer, so callers fall back to what the
  // devices report.
  async getAgentActivity(d: ActivityScope & { agentKeys: string[] }) {
    let rows = await this.loadActivity({ ...d, byMember: false });
    if (!rows) return null;

    let byAgent = new Map<string, Date>();
    for (let row of rows) latest(byAgent, row.agentKey, new Date(row.lastUsedAt));

    return byAgent;
  }

  // Keyed by `consumerAgentKey`. Members agent tracking can't match to a consumer are left out.
  async getConsumerAgentActivity(d: ActivityScope & { agentKeys: string[] }) {
    let privacy = await this.tryRead(() => loadPrivacy(d));
    if (!privacy || privacy.hideIndividuals) return null;

    let rows = await this.loadActivity({ ...d, byMember: true });
    if (!rows) return null;

    let consumerIds = await this.tryRead(() =>
      fromService(() =>
        resolveConsumerRefs({
          organizationId: d.organization.id,
          ids: unique(rows.map(row => row.memberId))
        })
      )
    );
    if (!consumerIds) return null;

    let byConsumerAgent = new Map<string, Date>();
    for (let row of rows) {
      let consumerId = row.memberId ? consumerIds.get(row.memberId) : undefined;
      if (!consumerId) continue;

      latest(
        byConsumerAgent,
        consumerAgentKey(consumerId, row.agentKey),
        new Date(row.lastUsedAt)
      );
    }

    return byConsumerAgent;
  }

  private async loadActivity(d: ActivityScope & { agentKeys: string[]; byMember: boolean }) {
    let agentKeys = unique(d.agentKeys);
    if (!agentKeys.length) return [];

    let enabled = await this.tryRead(() =>
      isAgentTrackingEnabledForOrganization({
        organization: d.organization,
        project: d.project
      })
    );
    if (!enabled) return null;

    let to = new Date(Math.floor(Date.now() / minuteMs) * minuteMs);

    return await this.tryRead(() =>
      cachedRead({
        scope: d,
        read: d.byMember ? 'agentActivity.byMember' : 'agentActivity.byAgent',
        input: { agentKeys, to: to.toISOString() },
        load: async (): Promise<ActivityRow[]> => {
          let result = await runUsageQuery(
            d,
            agentActivityQuery({
              window: { from: new Date(to.getTime() - agentActivityLookbackDays * dayMs), to },
              activeSince: new Date(to.getTime() - agentActiveWindowDays * dayMs),
              agentKeys,
              byMember: d.byMember
            })
          );

          return result.rows
            .filter(
              row => typeof row.agent == 'string' && typeof row.last_activity == 'string'
            )
            .map(row => ({
              agentKey: row.agent as string,
              memberId: typeof row.user == 'string' ? row.user : null,
              lastUsedAt: row.last_activity as string
            }));
        }
      })
    );
  }

  private async tryRead<T>(read: () => Promise<T>) {
    try {
      return await read();
    } catch {
      return null;
    }
  }
}

export let agentTrackingAgentActivityService = Service.create(
  'agentTrackingAgentActivityService',
  () => new AgentTrackingAgentActivityServiceImpl()
).build();
