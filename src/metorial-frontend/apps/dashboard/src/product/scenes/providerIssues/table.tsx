import { DashboardInstanceProviderIssuesListOutput } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  f,
  withDefaults,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviderIssues } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import {
  getProviderIssueTitle,
  ProviderIssueSeverityBadge,
  ProviderIssueTypeBadge,
  providerIssueTypeLabels
} from './labels';

type ProviderIssue = DashboardInstanceProviderIssuesListOutput['items'][number];

let truncate = (str: string, maxLength: number) =>
  str.length <= maxLength ? str : str.slice(0, maxLength) + '...';

let ProviderIssuesList = createDataList<{}>('provider-issues')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    type: f.select('type', 'Type', [
      { id: 'provider_error', label: providerIssueTypeLabels.provider_error },
      { id: 'auth_error', label: providerIssueTypeLabels.auth_error },
      { id: 'protoguard_warning', label: providerIssueTypeLabels.protoguard_warning }
    ]),
    severity: f.select('severity', 'Severity', [
      { id: 'critical', label: 'Critical' },
      { id: 'error', label: 'Error' },
      { id: 'warning', label: 'Warning' }
    ]),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    lastSeenAt: f.date('lastSeenAt', 'Last Seen')
  }))
  .search('Search by provider, code, message or ID…')
  .paginated(({ ctx, filters, search }) =>
    useProviderIssues(
      ctx.instanceId,
      withDefaults(undefined, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.twoLine<ProviderIssue>({
      id: 'issue',
      header: 'Issue',
      primary: issue => getProviderIssueTitle(issue),
      secondary: issue => truncate(issue.message, 100)
    }),
    col.custom<ProviderIssue>({
      id: 'type',
      header: 'Type',
      render: issue => <ProviderIssueTypeBadge type={issue.type} />
    }),
    col.custom<ProviderIssue>({
      id: 'severity',
      header: 'Severity',
      render: issue => <ProviderIssueSeverityBadge severity={issue.severity} />
    }),
    col.count<ProviderIssue>('occurrenceCount', issue => issue.occurrenceCount, 'occurrence', {
      header: 'Occurrences'
    }),
    col.date<ProviderIssue>('lastSeenAt', { header: 'Last Seen', isDefault: true }),
    col.date<ProviderIssue>('firstSeenAt', { header: 'First Seen' }),
    col.id({ header: 'Issue ID' }),
    col.refId('providerId', (issue: ProviderIssue) => issue.providerId, {
      header: 'Provider ID'
    })
  ])
  .link((issue, _props, ctx) =>
    Paths.instance.providerIssue(ctx.organization, ctx.project, ctx.instance, issue.id)
  )
  .build();

export let ProviderIssuesTable = ({ layout }: { layout?: TableLayoutProps } = {}) => (
  <ProviderIssuesList emptyState="No issues found." {...layout} />
);
