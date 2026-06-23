import { delay } from '@lowerdeck/delay';
import type {
  DashboardInstanceSkillsExportsCreateBody,
  DashboardInstanceSkillsExportsGetOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export type CreateSkillExportInput = DashboardInstanceSkillsExportsCreateBody & {
  instanceId: string;
};

export let skillExportsLoader = createLoader({
  name: 'skillExports',
  parents: [],
  fetch: async () => [],
  mutators: {}
});

let pollSkillExport = async (d: {
  get: (skillExportId: string) => Promise<DashboardInstanceSkillsExportsGetOutput>;
  skillExportId: string;
}) => {
  let startedAt = Date.now();
  let timeoutMs = 10 * 60 * 1000;
  let intervalMs = 5000;

  while (Date.now() - startedAt < timeoutMs) {
    let skillExport = await d.get(d.skillExportId);

    if (skillExport.status === 'completed') {
      if (!skillExport.fileLink) throw new Error('Export completed without a download link');
      return skillExport;
    }

    if (skillExport.status === 'failed') throw new Error('Export failed');

    await delay(intervalMs);
  }

  throw new Error('Export timed out');
};

export let useCreateSkillExport = skillExportsLoader.createExternalMutator(
  (i: CreateSkillExportInput) =>
    withAuth(async sdk => {
      let skillExport = await sdk.skillExports.create(i.instanceId, i);

      return await pollSkillExport({
        skillExportId: skillExport.id,
        get: skillExportId => sdk.skillExports.get(i.instanceId, skillExportId)
      });
    })
);
