import { DashboardInstanceProviderAuthConfigErrorsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigErrors
} from '@metorial/state';
import { Badge, Button, Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { showProviderInvocationPanel } from '../providerInvocations/panel';

type ErrorBadgeColor = 'red' | 'orange' | 'yellow' | 'purple' | 'gray';

let ERROR_META: Record<string, { label: string; color: ErrorBadgeColor }> = {
  tool_call_failed: { label: 'Tool Call Failed', color: 'red' },
  config_validation_failed: { label: 'Config Validation Failed', color: 'orange' },
  auth_processing_failed: { label: 'Auth Processing Failed', color: 'red' },
  oauth_token_refresh_failed: { label: 'OAuth Token Refresh Failed', color: 'orange' },
  oauth_setup_failed: { label: 'OAuth Setup Failed', color: 'red' },
  trigger_event_input_failed: { label: 'Trigger Event Input Failed', color: 'yellow' },
  profile_fetch_failed: { label: 'Profile Fetch Failed', color: 'purple' }
};

let humanizeCode = (code: string) =>
  code
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

let getErrorBadgeColor = (code: string): ErrorBadgeColor => {
  if (ERROR_META[code]) return ERROR_META[code].color;
  if (code.includes('validation') || code.includes('refresh') || code.includes('input'))
    return 'orange';
  if (code.endsWith('_failed') || code.includes('error')) return 'red';
  return 'gray';
};

let getErrorLabel = (code: string) => ERROR_META[code]?.label ?? humanizeCode(code);

export let ProviderAuthErrorsTable = (
  props: DashboardInstanceProviderAuthConfigErrorsListQuery & {
    emptyText?: string;
    linkToDetail?: boolean;
  }
) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { emptyText, linkToDetail, ...query } = props;
  let errors = useProviderAuthConfigErrors(instance.data?.id, {
    limit: 10,
    order: 'desc',
    ...query
  });

  let getDetailHref = (id: string) =>
    Paths.instance.providerAuthError(organization.data, project.data, instance.data, id);

  return renderWithPagination(errors, {
    hidePaginationWhenUnavailable: true
  })(errors => (
    <>
      <Table
        headers={['Error', 'Message', 'Created', ...(!linkToDetail ? [''] : [])]}
        data={errors.data.items.map(error => {
          let actions = (
            <Flex justify="end" gap={8} style={{ width: '100%' }}>
              {error.providerInvocationId ? (
                <Button
                  size="1"
                  variant="outline"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    showProviderInvocationPanel({
                      providerInvocationId: error.providerInvocationId!
                    });
                  }}
                >
                  View Logs
                </Button>
              ) : null}
            </Flex>
          );

          return {
            href: linkToDetail ? getDetailHref(error.id) : undefined,
            data: [
              <Badge color={getErrorBadgeColor(error.code)}>{getErrorLabel(error.code)}</Badge>,
              <Text size="2">{error.message}</Text>,
              <RenderDate date={error.createdAt} />,
              ...(!linkToDetail ? [actions] : [])
            ]
          };
        })}
      />

      {errors.data.items.length === 0 ? (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          {emptyText ?? 'No auth errors found.'}
        </Text>
      ) : null}
    </>
  ));
};
