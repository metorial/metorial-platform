import { EmptyState } from '@metorial/empty-state';
import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useChatConnections } from '@metorial/state';
import { Text } from '@metorial/ui';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { showCreateChatConnectionFlow } from './connectionPanelFlow';
import { ChatProviderAvatar, useChatProviderListings } from './shared';

let ChatConnectionsList = createDataList<{ instanceId: string }>('chat-connections')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search chat connections…')
  .paginated(({ props, filters, search, limit }) =>
    useChatConnections(
      props.instanceId,
      withDefaults(
        { order: 'desc' as const, status: ['active' as const], limit },
        { ...filters, search }
      )
    )
  )
  .enrich((items, { props }) => {
    let providerIds = useMemo(
      () => items.flatMap(row => row.providers.map(provider => provider.provider.id)),
      [items]
    );
    let listings = useChatProviderListings(props.instanceId, providerIds);
    let enriched = useMemo(
      () => items.map(row => ({ ...row, providerLookup: listings.lookup })),
      [items, listings.lookup]
    );

    return { items: enriched, isLoading: listings.isLoading, error: listings.error };
  })
  .columns([
    col.name(),
    col.text({
      id: 'provider',
      header: 'Provider',
      get: row => {
        let provider = row.providers[0]?.provider;
        return provider
          ? (row.providerLookup.get(provider.id)?.name ?? provider.name)
          : undefined;
      }
    }),
    col.text({ id: 'slug', header: 'Slug', isDefault: false, get: row => row.slug }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.chatConnection(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .item(row => ({
    title: row.name,
    description: row.description,
    icon: (
      <ChatProviderAvatar
        provider={row.providers[0]?.provider}
        listings={row.providerLookup}
      />
    ),
    footer: row.slug ? <Text size="1">{row.slug}</Text> : undefined,
    height: 200
  }))
  .layouts(['grid', 'table'], { default: 'grid', gridWidth: '300px' })
  .build();

export let ChatConnectionsGrid = (p: { instanceId: string }) => {
  let navigate = useNavigate();
  let { organization, project, instance } = useInstanceContext();

  let createConnection = () =>
    showCreateChatConnectionFlow({
      onCreate: chatConnection =>
        navigate(
          Paths.instance.chatConnection(organization, project, instance, chatConnection.id)
        )
    });

  return (
    <ChatConnectionsList
      instanceId={p.instanceId}
      emptyState={{
        initial: () => (
          <EmptyState
            extra="Chat"
            title="Connect your first chat provider"
            description="Connect Metorial to chat providers like Slack, then connect agents to send and receive messages."
            action={{ label: 'Create Chat Connection', onClick: createConnection }}
          />
        ),
        search: 'No chat connections found.'
      }}
    />
  );
};
