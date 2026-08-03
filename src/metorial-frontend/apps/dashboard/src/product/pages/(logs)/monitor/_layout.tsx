import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMonitor
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useParams } from 'react-router-dom';
import styled from 'styled-components';

let OutletWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;

  > * {
    flex: 1;
    min-height: 0;
  }
`;

export let MonitorLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let { monitorId } = useParams();
  let monitor = useMonitor(instance.data?.id, monitorId);

  return (
    <ExtraHeaderLayout
      header={
        <Link to={Paths.instance.monitors(organization.data, project.data, instance.data)}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all monitors
          </Button>
        </Link>
      }
    >
      {renderWithLoader({ monitor })(({ monitor }) => (
        <ContentPanelLayout
          title={monitor.data.name}
          description={monitor.data.description ?? undefined}
          breadcrumbs={[
            {
              label: 'Monitors',
              to: Paths.instance.monitors(organization.data, project.data, instance.data)
            },
            {
              label: monitor.data.name,
              to: Paths.instance.monitor(
                organization.data,
                project.data,
                instance.data,
                monitor.data.id
              )
            }
          ]}
        >
          <InitialLoadBoundary>
            <OutletWrapper>
              <Outlet />
            </OutletWrapper>
          </InitialLoadBoundary>
        </ContentPanelLayout>
      ))}
    </ExtraHeaderLayout>
  );
};
