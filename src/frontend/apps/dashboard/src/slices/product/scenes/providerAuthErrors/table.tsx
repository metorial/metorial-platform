import { DashboardInstanceProviderAuthConfigErrorsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigErrors
} from '@metorial/state';
import { Button, Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
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
            href: linkToDetail ? getDetailHref(error.groupId ?? error.id) : undefined,
            data: [
              <Text size="2">{getErrorLabel(error.code)}</Text>,
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
