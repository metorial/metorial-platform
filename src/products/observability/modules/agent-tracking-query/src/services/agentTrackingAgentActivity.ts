import { isServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
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

export type AgentActivity = {
  lastUsed: Map<string, Date>;
  complete: boolean;
};

export let consumerAgentKey = (consumerId: string, agentKey: string) =>
  `${consumerId}:${agentKey}`;

// A key missing from a truncated result may still have been used, so it stays unknown.
export let getLastUsed = (activity: AgentActivity | null, key: string) => {
  if (!activity) return null;

  let lastUsedAt = activity.lastUsed.get(key);
  if (lastUsedAt) return { lastUsedAt };

  return activity.complete ? { lastUsedAt: null } : null;
};

let latest = (map: Map<string, Date>, key: string, date: Date) => {
  let current = map.get(key);
  if (!current || current < date) map.set(key, date);
};

class AgentTrackingAgentActivityServiceImpl {
  async getAgentActivity(
    d: ActivityScope & { agentKeys: string[] }
  ): Promise<AgentActivity | null> {
    let result = await this.loadActivity({ ...d, byMember: false });
    if (!result) return null;

    let lastUsed = new Map<string, Date>();
    for (let row of result.rows) latest(lastUsed, row.agentKey, new Date(row.lastUsedAt));

    return { lastUsed, complete: !result.truncated };
  }

  async getConsumerAgentActivity(
    d: ActivityScope & { agentKeys: string[] }
  ): Promise<AgentActivity | null> {
    let privacy = await this.tryRead(() => loadPrivacy(d));
    if (!privacy || privacy.hideIndividuals) return null;

    let result = await this.loadActivity({ ...d, byMember: true });
    if (!result) return null;

    let rows = result.rows;
    let consumerIds = await this.tryRead(() =>
      fromService(() =>
        resolveConsumerRefs({
          organizationId: d.organization.id,
          ids: unique(rows.map(row => row.memberId))
        })
      )
    );
    if (!consumerIds) return null;

    let lastUsed = new Map<string, Date>();
    for (let row of rows) {
      let consumerId = row.memberId ? consumerIds.get(row.memberId) : undefined;
      if (!consumerId) continue;

      latest(lastUsed, consumerAgentKey(consumerId, row.agentKey), new Date(row.lastUsedAt));
    }

    return { lastUsed, complete: !result.truncated };
  }

  private async loadActivity(d: ActivityScope & { agentKeys: string[]; byMember: boolean }) {
    let agentKeys = unique(d.agentKeys);
    if (!agentKeys.length) return { rows: [] as ActivityRow[], truncated: false };

    let enabled = await isAgentTrackingEnabledForOrganization({
      organization: d.organization,
      project: d.project
    });
    if (!enabled) return null;

    let to = new Date(Math.floor(Date.now() / minuteMs) * minuteMs);

    return await this.tryRead(() =>
      cachedRead({
        scope: d,
        read: d.byMember ? 'agentActivity.byMember' : 'agentActivity.byAgent',
        input: { agentKeys, to: to.toISOString() },
        load: async () => {
          let result = await runUsageQuery(
            d,
            agentActivityQuery({
              window: { from: new Date(to.getTime() - agentActivityLookbackDays * dayMs), to },
              activeSince: new Date(to.getTime() - agentActiveWindowDays * dayMs),
              agentKeys,
              byMember: d.byMember
            })
          );

          let rows: ActivityRow[] = result.rows
            .filter(
              row => typeof row.agent == 'string' && typeof row.last_activity == 'string'
            )
            .map(row => ({
              agentKey: row.agent as string,
              memberId: typeof row.user == 'string' ? row.user : null,
              lastUsedAt: row.last_activity as string
            }));

          return { rows, truncated: !!result.meta?.truncated };
        }
      })
    );
  }

  private async tryRead<T>(read: () => Promise<T>) {
    try {
      return await read();
    } catch (error) {
      if (isServiceError(error)) return null;

      getSentry().captureException(error);
      console.error('[agent-tracking-query] Could not load agent activity', error);

      return null;
    }
  }
}

export let agentTrackingAgentActivityService = Service.create(
  'agentTrackingAgentActivityService',
  () => new AgentTrackingAgentActivityServiceImpl()
).build();
