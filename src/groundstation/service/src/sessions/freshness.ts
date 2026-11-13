import type { SessionDocument } from '../store/derivedModels';
import { SUMMARY_VERSION } from './versions';

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
