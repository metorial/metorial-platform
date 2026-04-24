import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionErrorGroup
} from '@metorial/state';
import { Badge, Button, RenderDate, Text, theme } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
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

export let ProviderErrorLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerErrorId } = useParams();
  let error = useSessionErrorGroup(instance.data?.id, providerErrorId);

  let pathname = useLocation().pathname;

  let providerPathParams = [
    organization.data,
    project.data,
    instance.data,
    error.data?.id ?? providerErrorId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link
          to={Paths.instance.providerErrors(organization.data, project.data, instance.data)}
        >
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all errors
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={error.data?.message ?? `Error ${providerErrorId?.slice(0, 8)}...`}
        breadcrumbs={[
          {
            label: 'Errors',
            to: Paths.instance.providerErrors(organization.data, project.data, instance.data)
          },
          {
            label: error.data?.code ?? 'Error',
            to: Paths.instance.providerError(...providerPathParams)
          }
        ]}
        extra={
          error.data ? (
            <ExtraRow>
              <ExtraItem>
                <ExtraLabel>Code</ExtraLabel>
                {error.data.code ? (
                  <Badge size="1" color="red">
                    {error.data.code}
                  </Badge>
                ) : (
                  <Text size="2">—</Text>
                )}
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Occurrences</ExtraLabel>
                <Text size="2">{error.data.occurrenceCount ?? '—'}</Text>
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>First Seen</ExtraLabel>
                <Text size="2">
                  <RenderDate date={error.data.createdAt} />
                </Text>
              </ExtraItem>
            </ExtraRow>
          ) : undefined
        }
        links={{
          current: pathname,
          items: [
            {
              label: 'Occurrences',
              to: Paths.instance.providerError(...providerPathParams)
            }
          ]
        }}
      >
        {renderWithLoader(
          { error },
          { spaceTop: 20 }
        )(({ error }) => (
          <OutletWrapper>
            <Outlet />
          </OutletWrapper>
        ))}
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
