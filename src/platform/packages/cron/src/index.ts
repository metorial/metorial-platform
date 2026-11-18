import {
  createCron as innerCreateCron,
  triggerCron as innerTriggerCron,
  type ICronProcessor
} from '@lowerdeck/cron';
import { getConfig } from '@metorial/config';

export { spreadCronPattern, type ICronProcessor } from '@lowerdeck/cron';

let scopedName = (name: string) => `mte/${name}`;

export let createCron = (
  opts: { name: string; cron: string; spread?: boolean; startupJitterMs?: number },
  handler: () => Promise<void>
): ICronProcessor => {
  opts.name = scopedName(opts.name);

  return innerCreateCron(
    {
      ...opts,
      redisUrl: getConfig().redisUrl
    },
    handler
  );
};

export let triggerCron = (name: string) =>
  innerTriggerCron({ name: scopedName(name), redisUrl: getConfig().redisUrl });
