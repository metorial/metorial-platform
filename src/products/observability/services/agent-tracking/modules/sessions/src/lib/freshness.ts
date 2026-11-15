import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { SUMMARY_VERSION } from '@mtsrc/agent-tracking-layers';

export let isSummaryStale = (
  session: Pick<
    SessionDocument,
    'summary' | 'summaryWatermark' | 'lastObservedAt' | 'versions'
  >
) =>
  !session.summary ||
  !session.summaryWatermark ||
  session.summaryWatermark < session.lastObservedAt ||
  (session.versions?.summary ?? 0) < SUMMARY_VERSION;
