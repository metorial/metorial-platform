import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let portalSsoAccessAuditResource = resource({
  name: 'portal_sso_access',
  payload: v.typedAny<{
    portalId: string;
    consumerGroupId: string | null;
    connectionId: string;
    mode: string;
    groupIds: string[];
    unresolvedGroupValues: string[];
  }>('portal_sso_access'),
  presenter: undefined,
  actions: { update: true }
});
