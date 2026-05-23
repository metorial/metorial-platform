import { createLock as rootCreateLock } from '@mtsrc/lock';
import { getConfig } from '@metorial/config';

export let createLock = ({ name }: { name: string }) => {
  return rootCreateLock({
    name,
    redisUrl: getConfig().redisUrl
  });
};
