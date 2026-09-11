import { createLock } from '@lowerdeck/lock';
import { env } from '../env';

let sessionTemplateSyncLock = createLock({
  name: 'sub-ses-st-sync-lock',
  redisUrl: env.service.REDIS_URL
});

export let queueJobId = (...parts: (string | undefined | null)[]) =>
  parts
    .filter((part): part is string => !!part)
    .join('-')
    .replace(/:/g, '-');

export let withSessionTemplateSyncLock = async <T>(
  sessionTemplateId: string,
  cb: () => Promise<T>
) => {
  return await sessionTemplateSyncLock.usingLock(queueJobId('st', sessionTemplateId), cb);
};
