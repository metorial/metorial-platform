import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let outpostAccessResource = resource({
  name: 'outpost_access',
  payload: v.typedAny<{
    outpostId: string;
    organizationId: string;
    grants: { projectId: string; instanceId: string; services: string[] }[];
  }>('outpost_access'),
  presenter: undefined,
  actions: {
    update: true
  }
});
