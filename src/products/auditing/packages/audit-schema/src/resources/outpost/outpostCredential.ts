import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let outpostCredentialResource = resource({
  name: 'outpost_credential',
  payload: v.typedAny<{
    id: string;
    status: string;
    outpostId: string;
    name: string;
    expiresAt: Date | null;
  }>('outpost_credential'),
  presenter: undefined,
  actions: {
    create: true,
    disable: true,
    delete: true,
    expire: true
  }
});
