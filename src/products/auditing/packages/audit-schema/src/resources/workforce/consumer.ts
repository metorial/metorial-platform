import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';
import type { ConsumerSurfaceSummary } from './_shared';

export let consumerAuditResource = resource({
  name: 'consumer',
  payload: v.typedAny<{
    id: string;
    consumerId: string;
    name: string;
    email: string;
    isOrganizationMember: boolean;
    isPortalConsumer: boolean;
    isManuallyCreated: boolean;
    isPending: boolean;
    organizationMemberId: string | null;
    userId: string | null;
  }>('consumer'),
  presenter: undefined,
  actions: {
    create: true,
    update: true
  }
});

export let consumerProfileAuditResource = resource({
  name: 'consumer_profile',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    email: string;
    inviteStatus: string;
    aresUserId: string | null;
    consumer: { id: string; email: string };
    ssoGroupIds: string[];
    ssoRoles: string[];
    surface: ConsumerSurfaceSummary;
  }>('consumer_profile'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let consumerProfileGroupAuditResource = resource({
  name: 'consumer_profile_group',
  payload: v.typedAny<{
    profile: { id: string; email: string };
    group: { id: string; name: string; isDefault: boolean };
    assignedVia: string | null;
  }>('consumer_profile_group'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});
