import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let consumerProviderSetupSessionAuditResource = resource({
  name: 'consumer_provider_setup_session',
  payload: v.typedAny<{
    id: string;
    setupSessionId: string;
    surfaceId: string;
    consumerProfile: { id: string; email: string };
    providerTemplate: { id: string; name: string };
  }>('consumer_provider_setup_session'),
  presenter: undefined,
  actions: {
    create: true
  }
});
