import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { Button } from '@metorial/ui';
import { useState } from 'react';
import { PortalsGrid, showPortalFormModal } from '../scenes/portals/portalsGrid';

export let PortalsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let [refreshKey, setRefreshKey] = useState(0);

  return renderWithLoader({ instance, organization, project })(
    ({ instance }) => (
      <ContentLayout>
        <PageHeader
          title="Portals"
          description="Manage the consumer-facing portals available for this instance."
          actions={
            <Button
              onClick={() =>
                showPortalFormModal({
                  instanceId: instance.data.id,
                  onCreate: () => setRefreshKey(current => current + 1)
                })
              }
            >
              Create Portal
            </Button>
          }
        />

        <PortalsGrid key={refreshKey} limit={30} />
      </ContentLayout>
    )
  );
};
