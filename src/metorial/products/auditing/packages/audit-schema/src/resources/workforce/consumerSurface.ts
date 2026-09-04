import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let consumerSurfaceAuditResource = resource({
  name: 'consumer_surface',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    name: string;
    description: string | null;
    isInternal: boolean;
    sessionExpiryTimeInSeconds: number;
    allowConsumerSkillAuthoring: boolean;
    allowConsumerSkillPublishing: boolean;
    emailWhitelist: string[];
    emailWhitelistCount: number;
    emailWhitelistTruncated: boolean;
  }>('consumer_surface'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
