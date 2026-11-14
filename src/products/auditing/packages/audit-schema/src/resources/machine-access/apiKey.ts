import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let apiKeyResource = resource({
  name: 'api_key',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    name: string;
    description: string | null;
    ipFilters: string[] | null;
    expiresAt: Date | null;
    deletedAt: Date | null;
  }>('api_key'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true,
    rotate: true,
    reveal: true,
    expire: true
  }
});
