import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let portalAuditResource = resource({
  name: 'portal',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    slug: string;
    description: string | null;
    isDefaultPortal: boolean;
    surfaceId: string;
    allowedRedirectUrlFilters: string[] | null;
  }>('portal'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
