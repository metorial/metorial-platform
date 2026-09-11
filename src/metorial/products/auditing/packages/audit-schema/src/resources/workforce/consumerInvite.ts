import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let consumerInviteAuditResource = resource({
  name: 'consumer_invite',
  payload: v.typedAny<{
    id: string;
    status: string;
    email: string;
    surfaceId: string;
    consumerProfileId: string;
    invitedByActorId: string | null;
    expiresAt: Date;
    acceptedAt: Date | null;
  }>('consumer_invite'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
