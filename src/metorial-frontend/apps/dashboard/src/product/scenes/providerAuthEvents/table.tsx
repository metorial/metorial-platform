import { DashboardInstanceProviderAuthConfigEventsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigEvents
} from '@metorial/state';
import { Badge, Button, Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { showProviderInvocationPanel } from '../providerInvocations/panel';

let EVENT_LABELS: Record<string, string> = {
  setup_link_opened: 'Setup Link Opened',
  get_authorization_url: 'Authorization URL Generated',
  exchange_authorization_code: 'Authorization Code Exchanged',
  access_token_received: 'Access Token Received',
  oauth_setup_completed: 'OAuth Setup Completed',
  oauth_setup_failed: 'OAuth Setup Failed'
};

let humanizeType = (type: string) =>
  type
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

let getEventLabel = (type: string) => EVENT_LABELS[type] ?? humanizeType(type);

let getStatusBadgeColor = (status: string): 'green' | 'red' | 'gray' => {
  if (status === 'success') return 'green';
  if (status === 'error') return 'red';
  return 'gray';
};

let getStatusLabel = (status: string) => {
  if (status === 'success') return 'Success';
  if (status === 'error') return 'Error';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export let ProviderAuthEventsTable = (
  props: DashboardInstanceProviderAuthConfigEventsListQuery & {
    emptyText?: string;
    linkToDetail?: boolean;
  }
) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { emptyText, linkToDetail, ...query } = props;
  let events = useProviderAuthConfigEvents(instance.data?.id, {
    limit: 10,
    order: 'desc',
    ...query
  });

  let getDetailHref = (id: string) =>
    Paths.instance.providerAuthEvent(organization.data, project.data, instance.data, id);

  return renderWithPagination(events, {
    hidePaginationWhenUnavailable: true
  })(events => (
    <>
      <Table
        headers={['Event', 'Status', 'Created', ...(!linkToDetail ? [''] : [])]}
        data={events.data.items.map(event => {
          let actions = (
            <Flex justify="end" gap={8} style={{ width: '100%' }}>
              {event.providerInvocationId ? (
                <Button
                  size="1"
                  variant="outline"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    showProviderInvocationPanel({
                      providerInvocationId: event.providerInvocationId!
                    });
                  }}
                >
                  View Logs
                </Button>
              ) : null}
            </Flex>
          );

          return {
            href: linkToDetail ? getDetailHref(event.id) : undefined,
            data: [
              <Text size="2">{getEventLabel(event.type)}</Text>,
              <Badge size="1" color={getStatusBadgeColor(event.status)}>
                {getStatusLabel(event.status)}
              </Badge>,
              <RenderDate date={event.createdAt} />,
              ...(!linkToDetail ? [actions] : [])
            ]
          };
        })}
      />

      {events.data.items.length === 0 ? (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          {emptyText ?? 'No auth events found.'}
        </Text>
      ) : null}
    </>
  ));
};
