import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Navigate } from 'react-router-dom';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ProviderIssuesTable } from '../../../scenes/providerIssues/table';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { providerId: 'providerId' },
  unsupported: [
    { param: 'type', label: 'type' },
    { param: 'severity', label: 'severity' }
  ],
  search: true
};

export let ProviderIssuesPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(() => (
    <ProviderIssuesTable
      layout={{
        framed: true,
        topContent: (
          <UsageEventsCard
            actions={picker}
            variant="strip"
            title="Issues"
            info="Tool errors, auth errors and ProtoGuard warnings over time. The table groups repeated occurrences of the same problem into one issue."
            hint={hint}
            filter={filter}
            range={range}
            kinds={['session_error', 'auth_error', 'protoguard_warning']}
            mode="group"
            groupBy="kind"
            collapseKey="logs-issues"
            height={120}
          />
        )
      }}
    />
  ));
};

export let ProviderIssuesRedirect = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return renderWithLoader({ organization, project, instance })(() => (
    <Navigate
      replace
      to={Paths.instance.providerIssues(organization.data, project.data, instance.data)}
    />
  ));
};
