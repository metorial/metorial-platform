import { DashboardInstanceProviderAuthConfigEventsListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineAction,
  defineStatus,
  f,
  withDefaults,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviderAuthConfigEvents } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
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

let eventStatus = defineStatus({
  success: { label: 'Success', color: 'green' },
  error: { label: 'Error', color: 'red' }
});

let ProviderAuthEventsList = createDataList<{
  query: DashboardInstanceProviderAuthConfigEventsListQuery;
  linkToDetail?: boolean;
}>('provider-auth-events')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    type: f.select(
      'type',
      'Event',
      Object.entries(EVENT_LABELS).map(([id, label]) => ({ id, label }))
    ),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    providerAuthConfigId: f.entity(entityFilters.providerAuthConfig(ctx.instanceId)),
    createdAt: f.createdAt()
  }))
  .search('Search by provider, auth method, auth config, credentials or event ID…')
  .paginated(({ props, ctx, filters, search, variant }) =>
    useProviderAuthConfigEvents(
      ctx.instanceId,
      withDefaults(
        { limit: variant == 'page' ? 25 : 10, order: 'desc' as const, ...props.query },
        { ...filters, search }
      )
    )
  )
  .columns([
    col.text({
      id: 'type',
      header: 'Event',
      get: event => EVENT_LABELS[event.type] ?? humanizeType(event.type)
    }),
    col.status(eventStatus),
    col.createdAt(),
    col.id()
  ])
  .link((event, props, ctx) =>
    props.linkToDetail
      ? Paths.instance.providerAuthEvent(ctx.organization, ctx.project, ctx.instance, event.id)
      : undefined
  )
  .itemActions([
    defineAction({
      id: 'view-logs',
      label: 'View Logs',
      bulk: false,
      hidden: event => !event.providerInvocationId,
      useRun: () => event => {
        showProviderInvocationPanel({ providerInvocationId: event.providerInvocationId! });
      }
    })
  ])
  .build();

export let ProviderAuthEventsTable = ({
  emptyText,
  linkToDetail,
  layout,
  ...query
}: DashboardInstanceProviderAuthConfigEventsListQuery & {
  emptyText?: string;
  linkToDetail?: boolean;
  layout?: TableLayoutProps;
}) => (
  <ProviderAuthEventsList
    query={query}
    linkToDetail={linkToDetail}
    emptyState={emptyText ?? 'No auth events found.'}
    {...(layout
      ? { ...layout, listVariant: 'page' as const }
      : { listVariant: 'embedded' as const, hideToolbar: true })}
  />
);
