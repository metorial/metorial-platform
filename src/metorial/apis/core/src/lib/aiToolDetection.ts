import { aiToolDetectionFlag } from '@metorial/module-consumer-core';
import type { BooleanFlagKey } from '@metorial/module-flags';

export let deviceFlags: BooleanFlagKey[] = [
  'paid-portals',
  'portals-access',
  'devices-enabled'
];

export let aiToolDetectionFlags: BooleanFlagKey[] = [...deviceFlags, aiToolDetectionFlag];
