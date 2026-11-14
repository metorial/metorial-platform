import { createCron as innerCreateCron } from '@lowerdeck/cron';
import { getConfig } from '@metorial/config';
import { IQueueProcessor } from '@metorial/queue';

export { spreadCronPattern } from '@lowerdeck/cron';

export let createCron = (
  opts: { name: string; cron: string; spread?: boolean; startupJitterMs?: number },
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
