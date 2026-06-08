import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  ContentPanelLayout,
  ContentPanelLayoutInner,
  ExtraHeaderLayout
} from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderRun
} from '@metorial/state';
import { Button, RenderDate, Text, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ProviderRunStatusBadge } from '../../../scenes/providerRun/table';

let ExtraRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 20px;
  align-items: center;
  margin-top: 4px;
  font-size: 13px;
  color: ${theme.colors.gray600};
`;

let ExtraItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

let ExtraLabel = styled.span`
  font-weight: 600;
  color: ${theme.colors.gray600};
`;

export let ProviderRunLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerRunId } = useParams();
  let run = useProviderRun(instance.data?.id, providerRunId);

  let pathname = useLocation().pathname;

  let providerRunParams = [
    organization.data,
    project.data,
    instance.data,
    run.data?.id ?? providerRunId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link to={Paths.instance.providerRuns(organization.data, project.data, instance.data)}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all provider runs
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title="Provider Run"
        breadcrumbs={[
          {
            label: 'Provider Runs',
            to: Paths.instance.providerRuns(organization.data, project.data, instance.data)
          },
          {
            label: run.data?.id ?? 'Provider Run',
            to: Paths.instance.providerRun(...providerRunParams)
          }
        ]}
        extra={
          run.data ? (
            <ExtraRow>
              <ExtraItem>
                <ExtraLabel>Status</ExtraLabel>
                <ProviderRunStatusBadge run={run.data} />
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Run ID</ExtraLabel>
                <ID id={run.data.id} />
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Created</ExtraLabel>
                <Text size="2">
                  <RenderDate date={run.data.createdAt} />
                </Text>
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Completed</ExtraLabel>
                <Text size="2">
                  {run.data.completedAt ? (
                    <RenderDate date={run.data.completedAt} />
                  ) : (
                    <span style={{ opacity: 0.6 }}>Running</span>
                  )}
                </Text>
              </ExtraItem>
            </ExtraRow>
          ) : undefined
        }
        links={{
          current: pathname,
          items: [
            {
              label: 'Logs',
              to: Paths.instance.providerRun(...providerRunParams)
            }
          ]
        }}
      >
        <ContentPanelLayoutInner>
          <InitialLoadBoundary>
            {renderWithLoader({ run })(({ run: _run }) => (
              <Outlet />
            ))}
          </InitialLoadBoundary>
        </ContentPanelLayoutInner>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
