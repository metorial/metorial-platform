import { renderWithLoader } from '@metorial/data-hooks';
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
  useProviderAuthConfigError
} from '@metorial/state';
import { Badge, Button, RenderDate, Text, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';

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

let getStatusColor = (status: string): 'red' | 'orange' | 'gray' => {
  if (status === 'processing') return 'orange';
  if (status === 'processed') return 'red';
  return 'gray';
};

export let ProviderAuthErrorLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthErrorId } = useParams();
  let error = useProviderAuthConfigError(instance.data?.id, providerAuthErrorId);

  let pathname = useLocation().pathname;

  let authErrorParams = [
    organization.data,
    project.data,
    instance.data,
    error.data?.id ?? providerAuthErrorId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link
          to={Paths.instance.providerAuthErrors(
            organization.data,
            project.data,
            instance.data
          )}
        >
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all auth errors
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={error.data?.message ?? `Auth error ${providerAuthErrorId?.slice(0, 8)}...`}
        breadcrumbs={[
          {
            label: 'Auth Errors',
            to: Paths.instance.providerAuthErrors(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: error.data?.code ?? 'Auth Error',
            to: Paths.instance.providerAuthError(...authErrorParams)
          }
        ]}
        extra={
          error.data ? (
            <ExtraRow>
              <ExtraItem>
                <ExtraLabel>Status</ExtraLabel>
                <Badge size="1" color={getStatusColor(error.data.status)}>
                  {error.data.status}
                </Badge>
              </ExtraItem>
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
                <ExtraLabel>Auth Error ID</ExtraLabel>
                <ID id={error.data.id} />
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Similar</ExtraLabel>
                <Text size="2">{error.data.similarErrorCount ?? '—'}</Text>
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Created</ExtraLabel>
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
              label: 'Details',
              to: Paths.instance.providerAuthError(...authErrorParams)
            }
          ]
        }}
      >
        <ContentPanelLayoutInner>
          {renderWithLoader({ error })(({ error: _error }) => (
            <Outlet />
          ))}
        </ContentPanelLayoutInner>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
