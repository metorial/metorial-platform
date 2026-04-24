import { DashboardInstanceProviderAuthConfigErrorsListOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigErrors
} from '@metorial/state';
import {
  Badge,
  Callout,
  CenteredSpinner,
  Datalist,
  RenderDate,
  Text,
  theme
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { DraggableSplitPane } from '../../../../components/draggableSplitPane';
import { ProviderAuthEventsTable } from '../providerAuthEvents/table';
import { CollapsibleBox } from '../sessionTracing/components/collapsibleBox';

type AuthError = DashboardInstanceProviderAuthConfigErrorsListOutput['items'][number];

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

let SplitPaneWrapper = styled.div`
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  overflow: hidden;

  > * {
    flex: 1;
    min-height: 0;
  }
`;

let PaneSection = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
`;

let PaneHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: ${theme.colors.background};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let PaneHeaderTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let PaneBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: ${theme.colors.background};
  scrollbar-width: thin;
  scrollbar-color: ${theme.colors.gray300} transparent;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.gray300};
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.gray500};
    background-clip: padding-box;
  }
`;

let OccurrenceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
`;

let OccurrenceButton = styled.div`
  width: 100%;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.background};
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &[data-active='true'] {
    border-color: ${theme.colors.red600};
    box-shadow: 0 0 0 1px ${theme.colors.red600};
  }

  &:hover {
    background: ${theme.colors.gray100};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 1px;
  }
`;

let OccurrenceRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
`;

let OccurrenceMessage = styled.div`
  font-size: 13px;
  color: ${theme.colors.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
`;

let OccurrenceMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: ${theme.colors.gray600};
`;

let RightBody = styled(PaneBody)`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let DashedLink = styled(Link)`
  color: ${theme.colors.gray900};
  text-decoration: underline dashed;
  text-decoration-color: ${theme.colors.gray500};
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  font-weight: 500;
  word-break: break-all;
  transition:
    color 120ms ease,
    text-decoration-color 120ms ease;

  &:hover {
    color: ${theme.colors.gray700};
    text-decoration-color: ${theme.colors.gray700};
  }
`;

let LoadingWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
`;

let EmptyState = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 18px;
  font-weight: 500;
  color: ${theme.colors.gray600};
  text-align: center;
`;

export let ProviderAuthErrorGroupScene = ({ errorGroupId }: { errorGroupId: string }) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let errors = useProviderAuthConfigErrors(instanceId, {
    providerAuthConfigErrorGroupId: errorGroupId,
    limit: 100,
    order: 'desc'
  });

  let errorItems = useMemo(() => errors.data?.items ?? [], [errors.data?.items]);

  let [activeErrorId, setActiveErrorId] = useState<string | null>(null);

  let effectiveActiveErrorId = activeErrorId ?? errorItems[0]?.id ?? null;

  let activeError = useMemo(
    () =>
      effectiveActiveErrorId
        ? (errorItems.find(e => e.id === effectiveActiveErrorId) ?? null)
        : null,
    [errorItems, effectiveActiveErrorId]
  );

  useLayoutEffect(() => {
    try {
      (window as any).metorial_setRestrictHeight(true);
    } catch {}

    return () => {
      try {
        (window as any).metorial_setRestrictHeight(false);
      } catch {}
    };
  }, [errorGroupId]);

  let occurrenceCount = errorItems.length;

  return (
    <SplitPaneWrapper>
      <DraggableSplitPane
        initialLeftSize={380}
        storageKey="metorial.providerAuthErrorGroup.splitPane"
        left={
          <OccurrencesPane
            activeErrorId={effectiveActiveErrorId}
            errorItems={errorItems}
            isLoading={errors.isLoading}
            onOpenError={setActiveErrorId}
            occurrenceCount={occurrenceCount}
          />
        }
        right={
          <PaneSection>
            {activeError ? (
              <RightBody>
                <ErrorDetails error={activeError} />
              </RightBody>
            ) : errors.isLoading ? (
              <LoadingWrap>
                <CenteredSpinner size={16} />
              </LoadingWrap>
            ) : (
              <EmptyState>
                {occurrenceCount === 0
                  ? 'No occurrences have been recorded for this error yet.'
                  : 'Select an occurrence from the left to inspect its details.'}
              </EmptyState>
            )}
          </PaneSection>
        }
      />
    </SplitPaneWrapper>
  );
};

let OccurrencesPane = ({
  activeErrorId,
  errorItems,
  isLoading,
  onOpenError,
  occurrenceCount
}: {
  activeErrorId: string | null;
  errorItems: AuthError[];
  isLoading: boolean;
  onOpenError: (id: string) => void;
  occurrenceCount: number;
}) => {
  return (
    <PaneSection>
      <PaneBody>
        <PaneHeader>
          <PaneHeaderTitle>Occurrences</PaneHeaderTitle>

          {occurrenceCount > 0 && (
            <Badge size="1" color="gray">
              {occurrenceCount}
            </Badge>
          )}
        </PaneHeader>

        <OccurrenceList>
          {errorItems.map(error => (
            <OccurrenceButton
              key={error.id}
              role="button"
              tabIndex={0}
              data-active={error.id === activeErrorId}
              onClick={() => onOpenError(error.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenError(error.id);
                }
              }}
            >
              <OccurrenceRow>
                <OccurrenceMessage>{error.message}</OccurrenceMessage>
              </OccurrenceRow>

              <OccurrenceMeta>
                <Badge size="1" color={error.status === 'processed' ? 'red' : 'orange'}>
                  {error.status}
                </Badge>
                <Text size="1" color="gray600">
                  <RenderDate date={error.createdAt} format="time" />
                </Text>
              </OccurrenceMeta>
            </OccurrenceButton>
          ))}

          {isLoading && (
            <LoadingWrap>
              <CenteredSpinner size={16} />
            </LoadingWrap>
          )}

          {!occurrenceCount && !isLoading && (
            <Callout color="gray">
              No occurrences have been recorded for this error yet.
            </Callout>
          )}
        </OccurrenceList>
      </PaneBody>
    </PaneSection>
  );
};

let ErrorDetails = ({ error }: { error: AuthError }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let eventsQuery = error.providerOauthSetupId
    ? {
        providerOauthSetupId: error.providerOauthSetupId,
        emptyText: 'No auth events have been recorded for this OAuth setup.'
      }
    : error.providerAuthConfigId
      ? {
          providerAuthConfigId: error.providerAuthConfigId,
          emptyText: 'No auth events have been recorded for this auth config.'
        }
      : null;

  let items: { label: ReactNode; value: ReactNode }[] = [
    { label: 'Error ID', value: <ID id={error.id} /> },
    {
      label: 'Status',
      value: (
        <Badge size="1" color={error.status === 'processed' ? 'red' : 'orange'}>
          {error.status}
        </Badge>
      )
    },
    { label: 'Code', value: <>{getErrorLabel(error.code)}</> },
    { label: 'Type', value: <>{getErrorLabel(error.type)}</> },
    { label: 'Created', value: <RenderDate date={error.createdAt} /> }
  ];

  if (error.providerAuthConfigId) {
    items.push({
      label: 'Auth Config',
      value: (
        <DashedLink
          to={Paths.instance.providerAuthConfig(
            organization.data,
            project.data,
            instance.data,
            error.providerAuthConfigId
          )}
        >
          {error.providerAuthConfigId}
        </DashedLink>
      )
    });
  }

  if (error.providerAuthCredentialsId) {
    items.push({
      label: 'Auth Credentials',
      value: (
        <DashedLink
          to={Paths.instance.providerAuthCredential(
            organization.data,
            project.data,
            instance.data,
            error.providerAuthCredentialsId
          )}
        >
          {error.providerAuthCredentialsId}
        </DashedLink>
      )
    });
  }

  if (error.authConfigEventId) {
    items.push({
      label: 'Auth Event',
      value: (
        <DashedLink
          to={Paths.instance.providerAuthEvent(
            organization.data,
            project.data,
            instance.data,
            error.authConfigEventId
          )}
        >
          {error.authConfigEventId}
        </DashedLink>
      )
    });
  }

  return (
    <>
      <CollapsibleBox
        defaultCollapsed
        id="provider-auth-error-details"
        title="Details"
        description={`${getErrorLabel(error.code)} occurrence metadata.`}
        rightActions={
          <Badge size="1" color={error.status === 'processed' ? 'red' : 'orange'}>
            {error.status}
          </Badge>
        }
      >
        <Datalist items={items} />
      </CollapsibleBox>

      {eventsQuery ? <ProviderAuthEventsTable {...eventsQuery} /> : null}
    </>
  );
};
