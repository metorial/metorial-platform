import { createCron as innerCreateCron } from '@mtsrc/cron';
import { getConfig } from '@metorial/config';
import { IQueueProcessor } from '@metorial/queue';

export let createCron = (
  opts: { name: string; cron: string },
  handler: () => Promise<void>
): IQueueProcessor => {
  opts.name = `mte/${opts.name}`;

  return innerCreateCron(
    {
      ...opts,
      redisUrl: getConfig().redisUrl
    },
    handler
  );
};
