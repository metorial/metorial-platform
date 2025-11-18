import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { showPortalFormModal } from '../../../scenes/portals/portalsGrid';

export let PortalsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Portals"
        description="Use Portals to create custom branded MCP server marketplaces for your organization."
        actions={
          <>
            <Button onClick={() => showPortalFormModal()} size="2">
              Create Portal
            </Button>
          </>
        }
      />

      <Outlet />
    </ContentLayout>
  );
};
