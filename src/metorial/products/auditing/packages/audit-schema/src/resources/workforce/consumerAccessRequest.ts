import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';
import type { ConsumerAccessTargetSummary } from './_shared';

export let consumerAccessRequestAuditResource = resource({
  name: 'consumer_access_request',
  payload: v.typedAny<{
    id: string;
    status: string;
    surfaceId: string;
    consumerProfile: { id: string; email: string };
    target: ConsumerAccessTargetSummary;
    message: string | null;
    messageTruncated: boolean;
    resolutionMessage: string | null;
    resolutionMessageTruncated: boolean;
    reviewedAt: Date | null;
  }>('consumer_access_request'),
  presenter: undefined,
  actions: {
    create: true,
    update: true
  }
});
