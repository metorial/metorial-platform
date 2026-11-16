import type { UsageMetricKind } from './types';

// Classification changes must rebuild historical messages as well as update live recording.
export let USAGE_MESSAGE_REVISION = 2;

export let USAGE_MESSAGE_BACKFILL_ID = `messages-v${USAGE_MESSAGE_REVISION}`;

export let usageMessageKinds: UsageMetricKind[] = ['message', 'tool_call'];
