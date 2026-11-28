import { Service } from '@lowerdeck/service';
import type { Instance, Organization, Project } from '@metorial/db';
import { isAgentTrackingEnabledForOrganization } from '@metorial/module-agent-tracking-sync';
import { consumerDeviceSettingsService } from '@metorial/module-consumer-core';
import { consumerAgentKey, type AgentActivity } from '../lib/agentActivity';
import { unique } from '../lib/entities';
import { resolveConsumerRefs } from '../lib/members';
import { loadPrivacy } from '../lib/privacy';
import {
  agentActiveWindowDays,
  agentActivityLookbackDays,
  agentActivityQuery
} from '../lib/queries';
import { cachedRead, runUsageQuery } from '../lib/scope';
import { failSoft, fromService } from '../lib/service';

let dayMs = 24 * 60 * 60 * 1000;

let minuteMs = 60 * 1000;

type ActivityScope = {
  organization: Organization;
  project: Project;
  instance: Pick<Instance, 'oid' | 'id' | 'name'>;
  reader: { isHuman: boolean; canReadAgentUsage: boolean };
};

type ActivityRow = { agentKey: string; memberId: string | null; lastUsedAt: string };

let latest = (map: Map<string, Date>, key: string, date: Date) => {
  let current = map.get(key);
  if (!current || current < date) map.set(key, date);
};

class AgentTrackingAgentActivityServiceImpl {
  async getAgentActivity(
    d: ActivityScope & { agentKeys: string[] }
  ): Promise<AgentActivity | null> {
    if (!(await this.isVisible(d))) return null;

    let result = await this.loadActivity({ ...d, byMember: false });
    if (!result) return null;

    return {
      lastUsed: new Map(result.rows.map(row => [row.agentKey, new Date(row.lastUsedAt)])),
      complete: !result.truncated
    };
  }

  async getConsumerAgentActivity(
    d: ActivityScope & { agentKeys: string[] }
  ): Promise<AgentActivity | null> {
    if (!(await this.isVisible(d))) return null;

    let privacy = await failSoft(() => loadPrivacy(d), null);
    if (!privacy || privacy.hideIndividuals) return null;

    let result = await this.loadActivity({ ...d, byMember: true });
    if (!result) return null;

    let rows = result.rows;
    let consumerIds = await failSoft(
      () =>
        fromService(() =>
          resolveConsumerRefs({
            organizationId: d.organization.id,
            ids: unique(rows.map(row => row.memberId))
          })
        ),
      null
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

  private async isVisible(d: ActivityScope) {
    if (!d.reader.isHuman || !d.reader.canReadAgentUsage) return false;

    return await consumerDeviceSettingsService.isAiToolDetectionActive(d);
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

    return await failSoft(
      () =>
        cachedRead({
          scope: d,
          read: d.byMember ? 'agentActivity.byMember' : 'agentActivity.byAgent',
          input: { agentKeys, to: to.toISOString() },
          load: async () => {
            let result = await runUsageQuery(
              d,
              agentActivityQuery({
                window: {
                  from: new Date(to.getTime() - agentActivityLookbackDays * dayMs),
                  to
                },
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
        }),
      null
    );
  }
}

export let agentTrackingAgentActivityService = Service.create(
  'agentTrackingAgentActivityService',
  () => new AgentTrackingAgentActivityServiceImpl()
).build();
