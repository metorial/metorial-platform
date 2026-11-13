import { vi } from 'vitest';
import {
  advanceRebuildRun,
  processRebuildItem,
  rebuildManyQueue,
  rebuildOrganizationsManyQueue,
  rebuildSingleQueue,
  startOrganizationRebuild,
  type RebuildTrigger
} from '../../queues/rebuild';
import { testDb } from '../../test/setup';

// Runs the rebuild queues inline: items queued by a page finish before the next page is read.
export let inlineRebuildQueues = () => {
  let pages: string[] = [];
  let items: { rebuildRunId: string; sessionKey: string }[] = [];

  vi.spyOn(rebuildManyQueue, 'add').mockImplementation((async (job: {
    rebuildRunId: string;
  }) => {
    pages.push(job.rebuildRunId);
  }) as never);
  vi.spyOn(rebuildSingleQueue, 'addManyWithOps').mockImplementation((async (
    jobs: { data: { rebuildRunId: string; sessionKey: string } }[]
  ) => {
    items.push(...jobs.map(job => job.data));
  }) as never);

  let drain = async () => {
    let processed: string[] = [];

    while (pages.length || items.length) {
      while (items.length) {
        let item = items.shift()!;

        await processRebuildItem(item);
        processed.push(item.sessionKey);
      }

      let rebuildRunId = pages.shift();
      if (!rebuildRunId) continue;

      let { more } = await advanceRebuildRun({ rebuildRunId });
      if (more) pages.push(rebuildRunId);
    }

    return processed;
  };

  return { pages, items, drain };
};

// Captures organization fan-outs and starts them for every organization, like the
// `many(org cursor)` processor does.
export let inlineOrganizationRebuilds = () => {
  let triggers: RebuildTrigger[] = [];

  vi.spyOn(rebuildOrganizationsManyQueue, 'add').mockImplementation((async (job: {
    trigger: RebuildTrigger;
  }) => {
    triggers.push(job.trigger);
  }) as never);

  let start = async () => {
    let organizations = await testDb.organization.findMany({
      where: { archivedAt: null },
      orderBy: { id: 'asc' }
    });
    let runs = [];

    for (let trigger of triggers.splice(0)) {
      for (let organization of organizations) {
        let run = await startOrganizationRebuild({ organizationId: organization.id, trigger });
        if (run) runs.push(run);
      }
    }

    return runs;
  };

  return { triggers, start };
};
