import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigErrorGroup
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

let ERROR_LABELS: Record<string, string> = {
  tool_call_failed: 'Tool Call Failed',
  config_validation_failed: 'Config Validation Failed',
  auth_processing_failed: 'Auth Processing Failed',
  oauth_token_refresh_failed: 'OAuth Token Refresh Failed',
  oauth_setup_failed: 'OAuth Setup Failed',
  trigger_event_input_failed: 'Trigger Event Input Failed',
  profile_fetch_failed: 'Profile Fetch Failed'
};

let humanizeCode = (code: string) =>
  code
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

let getErrorLabel = (code: string) => ERROR_LABELS[code] ?? humanizeCode(code);

let truncate = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

export let ProviderAuthErrorLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthErrorId } = useParams();
  let group = useProviderAuthConfigErrorGroup(instance.data?.id, providerAuthErrorId);

  let pathname = useLocation().pathname;

  let authErrorPathParams = [
    organization.data,
    project.data,
    instance.data,
    group.data?.id ?? providerAuthErrorId
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
        title={truncate(
          group.data?.message ?? `Auth error ${providerAuthErrorId?.slice(0, 8)}...`,
          80
        )}
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
            label: group.data?.code ? getErrorLabel(group.data.code) : 'Auth Error',
            to: Paths.instance.providerAuthError(...authErrorPathParams)
          }
        ]}
        extra={
          group.data ? (
            <ExtraRow>
              <ExtraItem>
                <ExtraLabel>Code</ExtraLabel>
                {group.data.code ? (
                  <Badge size="1" color="red">
                    {getErrorLabel(group.data.code)}
                  </Badge>
                ) : (
                  <Text size="2">—</Text>
                )}
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Occurrences</ExtraLabel>
                <Text size="2">{group.data.occurrenceCount ?? '—'}</Text>
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>First Seen</ExtraLabel>
                <Text size="2">
                  <RenderDate date={group.data.createdAt} />
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
              to: Paths.instance.providerAuthError(...authErrorPathParams)
            }
          ]
        }}
      >
        <InitialLoadBoundary>
          {renderWithLoader(
            { group },
            { spaceTop: 20 }
          )(({ group: _group }) => (
            <OutletWrapper>
              <Outlet />
            </OutletWrapper>
          ))}
        </InitialLoadBoundary>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
