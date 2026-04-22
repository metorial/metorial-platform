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

type EventBadgeColor =
  | 'red'
  | 'green'
  | 'blue'
  | 'orange'
  | 'gray'
  | 'cyan'
  | 'indigo'
  | 'purple';

let EVENT_META: Record<string, { label: string; color: EventBadgeColor }> = {
  setup_link_opened: { label: 'Setup Link Opened', color: 'blue' },
  get_authorization_url: { label: 'Authorization URL Generated', color: 'cyan' },
  exchange_authorization_code: { label: 'Authorization Code Exchanged', color: 'indigo' },
  access_token_received: { label: 'Access Token Received', color: 'green' },
  oauth_setup_completed: { label: 'OAuth Setup Completed', color: 'green' },
  oauth_setup_failed: { label: 'OAuth Setup Failed', color: 'red' }
};

let humanizeType = (type: string) =>
  type
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

let getEventBadgeColor = (type: string): EventBadgeColor => {
  if (EVENT_META[type]) return EVENT_META[type].color;
  if (type.endsWith('_failed') || type.includes('error')) return 'red';
  if (type.endsWith('_succeeded') || type.endsWith('_completed')) return 'green';
  if (type.includes('refresh') || type.includes('token')) return 'orange';
  if (type.includes('started') || type.includes('opened')) return 'blue';
  return 'gray';
};

let getEventLabel = (type: string) => EVENT_META[type]?.label ?? humanizeType(type);

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
        headers={['Event', 'Created', ...(!linkToDetail ? [''] : [])]}
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
              <Badge color={getEventBadgeColor(event.type)}>{getEventLabel(event.type)}</Badge>,
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
