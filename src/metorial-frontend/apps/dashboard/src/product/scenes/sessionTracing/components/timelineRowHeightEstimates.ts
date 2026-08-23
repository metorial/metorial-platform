import { TimelineItemData } from '../types';

export let DEFAULT_ROW_HEIGHT_ESTIMATES: Record<TimelineItemData['kind'], number> = {
  session_created: 56,
  connection_marker: 56,
  event: 64,
  message: 220,
  explorer_capabilities: 320,
  provider_run_logs: 160,
  invocation: 180
};

export let FALLBACK_ROW_HEIGHT_ESTIMATE = 120;

export let getEstimatedRowHeight = (
  heightCache: Map<string, number>,
  itemKey: string,
  kind: TimelineItemData['kind']
) =>
  heightCache.get(itemKey) ?? DEFAULT_ROW_HEIGHT_ESTIMATES[kind] ?? FALLBACK_ROW_HEIGHT_ESTIMATE;
