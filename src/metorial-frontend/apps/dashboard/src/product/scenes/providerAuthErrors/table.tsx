import { DashboardInstanceProviderAuthConfigErrorsListQuery } from '@metorial/dashboard-sdk';
import { col, createDataList, defineAction } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviderAuthConfigErrors } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { showProviderInvocationPanel } from '../providerInvocations/panel';

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

let ProviderAuthErrorsList = createDataList<{
  query: DashboardInstanceProviderAuthConfigErrorsListQuery;
  linkToDetail?: boolean;
}>('provider-auth-errors')
  .context(useInstanceContext)
  .paginated(({ props, ctx }) =>
    useProviderAuthConfigErrors(ctx.instanceId, {
      limit: 10,
      order: 'desc',
      ...props.query
    })
  )
  .columns([
    col.text({ id: 'code', header: 'Error', get: error => getErrorLabel(error.code) }),
    col.text({ id: 'message', header: 'Message', get: error => error.message }),
    col.createdAt(),
    col.id()
  ])
  .link((error, props, ctx) =>
    props.linkToDetail
      ? Paths.instance.providerAuthError(
          ctx.organization,
          ctx.project,
          ctx.instance,
          error.groupId ?? error.id
        )
      : undefined
  )
  .itemActions([
    defineAction({
      id: 'view-logs',
      label: 'View Logs',
      bulk: false,
      hidden: error => !error.providerInvocationId,
      useRun: () => error => {
        showProviderInvocationPanel({ providerInvocationId: error.providerInvocationId! });
      }
    })
  ])
  .build();

export let ProviderAuthErrorsTable = ({
  emptyText,
  linkToDetail,
  ...query
}: DashboardInstanceProviderAuthConfigErrorsListQuery & {
  emptyText?: string;
  linkToDetail?: boolean;
}) => (
  <ProviderAuthErrorsList
    query={query}
    linkToDetail={linkToDetail}
    emptyState={emptyText ?? 'No auth errors found.'}
    listVariant="embedded"
    hideToolbar
  />
);
