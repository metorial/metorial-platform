import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';
import type { ConsumerAccessTargetSummary } from './_shared';

export let consumerAccessAuditResource = resource({
  name: 'consumer_access',
  payload: v.typedAny<{
    id: string;
    accessLevel: string | null;
    surfaceId: string;
    consumerGroup: { id: string; name: string; type: string };
    target: ConsumerAccessTargetSummary;
    listing: {
      id: string;
      name: string;
      description: string | null;
      readmeByteSize: number;
    } | null;
  }>('consumer_access'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let consumerAccessListingAuditResource = resource({
  name: 'consumer_access_listing',
  payload: v.typedAny<{
    id: string;
    name: string;
    description: string | null;
    readmeByteSize: number;
    surfaceId: string;
    target: ConsumerAccessTargetSummary;
  }>('consumer_access_listing'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
