import { db } from '@metorial/db';

export type SkillDestinationSyncLogEntry = [number, string];

let logKey = (entry: SkillDestinationSyncLogEntry) => `${entry[0]}:${entry[1]}`;

export let appendSkillDestinationSyncLog = async (
  skillDestinationSyncId: string,
  message: string
) => {
  await db.skillDestinationSync.updateMany({
    where: { id: skillDestinationSyncId },
    data: {
      logs: {
        push: [Date.now(), message] satisfies SkillDestinationSyncLogEntry
      }
    }
  });
};

export let appendSkillDestinationSyncLogs = async (d: {
  skillDestinationSyncId: string;
  logs: SkillDestinationSyncLogEntry[];
}) => {
  if (d.logs.length === 0) return;

  let sync = await db.skillDestinationSync.findUnique({
    where: { id: d.skillDestinationSyncId },
    select: { logs: true }
  });
  if (!sync) return;

  let existingKeys = new Set(sync.logs.map(logKey));
  let newLogs = d.logs.filter(log => !existingKeys.has(logKey(log)));
  if (newLogs.length === 0) return;

  await db.skillDestinationSync.update({
    where: { id: d.skillDestinationSyncId },
    data: {
      logs: {
        set: [...sync.logs, ...newLogs]
      }
    }
  });
};
