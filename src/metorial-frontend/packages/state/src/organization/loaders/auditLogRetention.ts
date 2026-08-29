import type { DashboardOrganizationsConfigureAuditLogRetentionUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { organizationLoader } from './organization';

export let auditLogRetentionLoader = createLoader({
  name: 'auditLogRetention',
  parents: [organizationLoader],
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.organizations.configureAuditLogRetention.get(i.organizationId)),
  mutators: {
    update: (
      i: DashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
      { input }: { input: { organizationId: string } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.configureAuditLogRetention.update(input.organizationId, i)
      )
  }
});

export let useAuditLogRetention = (organizationId: string | null | undefined) => {
  let retention = auditLogRetentionLoader.use(organizationId ? { organizationId } : null);

  return {
    ...retention,
    updateMutator: retention.useMutator('update')
  };
};
