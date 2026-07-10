import { delay } from '@lowerdeck/delay';
import type {
  DashboardInstanceSkillsForkSyncsCreateBody,
  DashboardInstanceSkillsForkSyncsGetOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { skillMergeRequestLoader, skillMergeRequestsLoader } from './skillMergeRequests';
import { skillLoader } from './skills';

export type CreateSkillForkSyncInput = DashboardInstanceSkillsForkSyncsCreateBody & {
  instanceId: string;
};

export type SkillForkSync = DashboardInstanceSkillsForkSyncsGetOutput;

export let skillForkSyncsLoader = createLoader({
  name: 'skillForkSyncs',
  parents: [skillLoader, skillMergeRequestsLoader, skillMergeRequestLoader],
  fetch: async () => [],
  mutators: {}
});

let pollSkillForkSync = async (d: {
  get: (skillForkSyncId: string) => Promise<DashboardInstanceSkillsForkSyncsGetOutput>;
  skillForkSyncId: string;
}) => {
  let startedAt = Date.now();
  let timeoutMs = 10 * 60 * 1000;
  let intervalMs = 5000;

  while (Date.now() - startedAt < timeoutMs) {
    let skillForkSync = await d.get(d.skillForkSyncId);

    if (skillForkSync.status === 'completed' || skillForkSync.status === 'action_required') {
      return skillForkSync;
    }

    if (skillForkSync.status === 'failed') {
      throw new Error(
        skillForkSync.error ? `Skill sync failed: ${skillForkSync.error}` : 'Skill sync failed'
      );
    }

    if (skillForkSync.status === 'cancelled') {
      throw new Error(
        skillForkSync.error
          ? `Skill sync was cancelled: ${skillForkSync.error}`
          : 'Skill sync was cancelled'
      );
    }

    await delay(intervalMs);
  }

  throw new Error('Skill sync timed out after 10 minutes');
};

export let useCreateSkillForkSync = skillForkSyncsLoader.createExternalMutator(
  (i: CreateSkillForkSyncInput) =>
    withAuth(async sdk => {
      let skillForkSync = await sdk.skills.forkSyncs.create(i.instanceId, {
        skillId: i.skillId
      });

      return await pollSkillForkSync({
        skillForkSyncId: skillForkSync.id,
        get: skillForkSyncId => sdk.skills.forkSyncs.get(i.instanceId, skillForkSyncId)
      });
    })
);
