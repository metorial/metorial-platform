import {
  InitialLoadBoundary,
  PaginationSearchParamsProvider,
  renderWithLoader
} from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProtoGuardConfig
} from '@metorial/state';
import { Button, Text } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';

let OutletWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

export let ProtoGuardFilterLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let config = useProtoGuardConfig(instance.data?.id);
  let { filterId } = useParams();
  let pathname = useLocation().pathname;

  return (
    <ExtraHeaderLayout
      header={
        <Link to={Paths.instance.protoguard(organization.data, project.data, instance.data)}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to Protoguard
          </Button>
        </Link>
      }
    >
      {renderWithLoader({ config })(({ config }) => {
        let filter = config.data.filters.find(item => item.id === filterId);

        if (!filter) {
          return (
            <ContentPanelLayout title="Filter not found">
              <Text size="2" color="gray600">
                This Protoguard filter does not exist in the current configuration.
              </Text>
            </ContentPanelLayout>
          );
        }

        return (
          <ContentPanelLayout
            title={filter.name}
            description={filter.description ?? undefined}
            breadcrumbs={[
              {
                label: 'Protoguard',
                to: Paths.instance.protoguard(organization.data, project.data, instance.data)
              },
              {
                label: filter.name,
                to: Paths.instance.protoguardFilter(
                  organization.data,
                  project.data,
                  instance.data,
                  filter.id
                )
              }
            ]}
            links={{
              current: pathname,
              items: [
                {
                  label: 'Settings',
                  to: Paths.instance.protoguardFilter(
                    organization.data,
                    project.data,
                    instance.data,
                    filter.id
                  )
                },
                {
                  label: 'Events',
                  to: Paths.instance.protoguardFilter(
                    organization.data,
                    project.data,
                    instance.data,
                    filter.id,
                    'events'
                  )
                }
              ]
            }}
          >
            <InitialLoadBoundary>
              <OutletWrapper>
                <PaginationSearchParamsProvider enabled={true}>
                  <Outlet />
                </PaginationSearchParamsProvider>
              </OutletWrapper>
            </InitialLoadBoundary>
          </ContentPanelLayout>
        );
      })}
    </ExtraHeaderLayout>
  );
};
