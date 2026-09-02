import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let outpostResource = resource({
  name: 'outpost',
  payload: v.typedAny<{
    id: string;
    status: string;
    connectionStatus: string;
    organizationId: string;
    name: string;
    description: string | null;
  }>('outpost'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    disable: true,
    enable: true,
    delete: true
  }
});
