import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let consumerGroupAuditResource = resource({
  name: 'consumer_group',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    isDefaultEveryoneGroup: boolean;
    isManaged: boolean;
    ssoGroupIds: string[];
    surfaceId: string;
  }>('consumer_group'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
