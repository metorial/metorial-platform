import { checkEdition } from '@metorial/editions';

let storage = checkEdition('cloud')
  ? await import('./queryCloud')
  : await import('./postgres');

export type { UsagePoint, UsageSeries, UsageTotals } from './queryShared';

export let queryUsageTimeline = storage.queryUsageTimeline;

export let queryUsageSummary = storage.queryUsageSummary;
