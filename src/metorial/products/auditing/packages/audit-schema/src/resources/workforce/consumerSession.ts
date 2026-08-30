import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let consumerSessionAuditResource = resource({
  name: 'consumer_session',
  payload: v.typedAny<{
    id: string;
    consumerProfileId: string;
    consumerProfileEmail: string;
    surfaceId: string;
    portalId: string | null;
    ip: string;
    ua: string;
    expiresAt: Date;
    loggedOutAt: Date | null;
  }>('consumer_session'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});
