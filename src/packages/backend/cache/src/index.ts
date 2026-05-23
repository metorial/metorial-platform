import {
  createCachedFunction as innerCreateCachedFunction,
  createLocallyCachedFunction as innerCreateLocallyCachedFunction
} from '@mtsrc/cache';
import { getConfig } from '@metorial/config';

export let createCachedFunction = <I, O>(opts: {
  name: string;
  getHash: (i: I) => string;
  provider: (i: I, opts: { setTTL: (ttl: number) => void }) => Promise<O>;
  ttlSeconds: number;
  getTags?: (o: O, i: I) => string[];
}) => {
  return innerCreateCachedFunction({
    ...opts,
    redisUrl: getConfig().redisUrl
  });
};

export let createLocallyCachedFunction = <I, O>(opts: {
  getHash: (i: I) => string;
  provider: (i: I) => Promise<O>;
  ttlSeconds: number;
}) => {
  return innerCreateLocallyCachedFunction(opts);
};
