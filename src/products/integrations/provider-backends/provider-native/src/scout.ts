import { createScoutClient } from '@metorial-services/scout-client';
import { env } from './env';

export let scout =
  env.scout.SCOUT_TOKEN && env.scout.SCOUT_URL
    ? createScoutClient({
        endpoint: env.scout.SCOUT_URL,
        headers: { 'Scout-Auth': env.scout.SCOUT_TOKEN }
      })
    : null;
