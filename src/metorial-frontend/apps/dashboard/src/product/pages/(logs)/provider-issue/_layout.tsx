import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ExtraHeaderLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderIssue
} from '@metorial/state';
import { Button, RenderDate, Text, theme } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  getProviderIssueTitle,
  ProviderIssueSeverityBadge,
  ProviderIssueTypeBadge
} from '../../../scenes/providerIssues/labels';

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

let truncate = (str: string, maxLength: number) =>
  str.length <= maxLength ? str : str.slice(0, maxLength) + '...';

export let ProviderIssueLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerIssueId } = useParams();
  let issue = useProviderIssue(instance.data?.id, providerIssueId);

  let pathname = useLocation().pathname;

  let issuesPath = Paths.instance.providerIssues(
    organization.data,
    project.data,
    instance.data
  );
  let issuePath = Paths.instance.providerIssue(
    organization.data,
    project.data,
    instance.data,
    issue.data?.id ?? providerIssueId
  );

  return (
    <ExtraHeaderLayout
      header={
        <Link to={issuesPath}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all issues
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={truncate(issue.data?.message ?? `Issue ${providerIssueId?.slice(0, 8)}...`, 80)}
        breadcrumbs={[
          { label: 'Issues', to: issuesPath },
          { label: issue.data ? getProviderIssueTitle(issue.data) : 'Issue', to: issuePath }
        ]}
        extra={
          issue.data ? (
            <ExtraRow>
              <ExtraItem>
                <ExtraLabel>Type</ExtraLabel>
                <ProviderIssueTypeBadge type={issue.data.type} />
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Severity</ExtraLabel>
                <ProviderIssueSeverityBadge severity={issue.data.severity} />
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Occurrences</ExtraLabel>
                <Text size="2">{issue.data.occurrenceCount}</Text>
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>First Seen</ExtraLabel>
                <Text size="2">
                  <RenderDate date={issue.data.firstSeenAt} />
                </Text>
              </ExtraItem>
              <ExtraItem>
                <ExtraLabel>Last Seen</ExtraLabel>
                <Text size="2">
                  <RenderDate date={issue.data.lastSeenAt} />
                </Text>
              </ExtraItem>
            </ExtraRow>
          ) : undefined
        }
        links={{
          current: pathname,
          items: [{ label: 'Occurrences', to: issuePath }]
        }}
      >
        <InitialLoadBoundary>
          {renderWithLoader(
            { issue },
            { spaceTop: 20 }
          )(() => (
            <OutletWrapper>
              <Outlet />
            </OutletWrapper>
          ))}
        </InitialLoadBoundary>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
