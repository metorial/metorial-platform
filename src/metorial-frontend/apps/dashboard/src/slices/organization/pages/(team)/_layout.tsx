import { Paths } from '@metorial/frontend-config';
import { PageHeader } from '@metorial/layout';
import { useCurrentOrganization } from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';

export let OrganizationSettingsTeamLayout = () => {
  let org = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <>
      <PageHeader title="Members" description="Manage who has access to your organization." />

      <LinkTabs
        current={pathname}
        links={[
          { to: Paths.organization.members(org.data), label: 'Members' },
          { to: Paths.organization.invites(org.data), label: 'Invites' }
        ]}
      />

      <Outlet />
    </>
  );
};
