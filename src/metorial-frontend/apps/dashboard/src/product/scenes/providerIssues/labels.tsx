import { Badge } from '@metorial/ui';
import { getErrorLabel } from '../errorGroupLabel';

export type ProviderIssueType = 'provider_error' | 'auth_error' | 'protoguard_warning';

export type ProviderIssueSeverity = 'warning' | 'error' | 'critical';

export let providerIssueTypeLabels: Record<ProviderIssueType, string> = {
  provider_error: 'Tool Error',
  auth_error: 'Auth Error',
  protoguard_warning: 'ProtoGuard Warning'
};

let providerIssueTypeColors = {
  provider_error: 'red',
  auth_error: 'orange',
  protoguard_warning: 'purple'
} as const;

let providerIssueSeverityColors = {
  warning: 'yellow',
  error: 'red',
  critical: 'red'
} as const;

export let ProviderIssueTypeBadge = ({ type }: { type: ProviderIssueType }) => (
  <Badge color={providerIssueTypeColors[type]}>{providerIssueTypeLabels[type]}</Badge>
);

export let ProviderIssueSeverityBadge = ({
  severity
}: {
  severity: ProviderIssueSeverity;
}) => <Badge color={providerIssueSeverityColors[severity]}>{getErrorLabel(severity)}</Badge>;

export let getProviderIssueTitle = (issue: {
  type: ProviderIssueType;
  code: string;
  message: string;
}) => (issue.type == 'protoguard_warning' ? issue.message : getErrorLabel(issue.code));
