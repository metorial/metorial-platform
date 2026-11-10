import {
  AccessDetail,
  AccessEmpty,
  AccessEntityCell,
  AccessRow,
  AccessRowMenu,
  ShareList,
  SubjectAvatar,
  type AccessSubjectKind
} from '@metorial/access-ui';
import {
  useCreatePortalConsumerAccessQuiet,
  useDeletePortalConsumerAccess,
  usePortalConsumerGroups,
  usePortalConsumerProfiles
} from '@metorial/state';
import { confirm, Flex, Text, toast, type ComboboxItemData } from '@metorial/ui';
import { RiPuzzleLine, RiStackLine } from '@remixicon/react';
import { showMarketplaceManagerPanel } from './panel';
import { removeMarketplaceManager } from './shared';
import type { MarketplaceManagerRow } from './types';

let candidateLimit = 10;

type ManagerCandidate = {
  kind: AccessSubjectKind;
  consumerGroupId: string;
  name: string;
  imageUrl?: string | null;
  isDefault?: boolean;
};

let useManagerCandidates = (d: {
  instanceId: string;
  portalId: string;
  searchQuery?: string;
  excludeGroupIds: Set<string>;
}) => {
  let groups = usePortalConsumerGroups(d.instanceId, d.portalId, {
    status: ['active'],
    limit: candidateLimit,
    search: d.searchQuery
  });
  let people = usePortalConsumerProfiles(d.instanceId, d.portalId, {
    status: 'active',
    limit: candidateLimit,
    search: d.searchQuery
  });

  let groupItems: ComboboxItemData<ManagerCandidate>[] = (groups.data?.items ?? [])
    .filter(group => !d.excludeGroupIds.has(group.id))
    .map(group => ({
      id: `group:${group.id}`,
      label: group.name,
      description: group.description ?? undefined,
      data: {
        kind: 'group',
        consumerGroupId: group.id,
        name: group.name,
        isDefault: group.isDefault
      }
    }));

  let personItems = (people.data?.items ?? []).flatMap(person => {
    let personal = person.groups?.find(assignment => assignment.assignedVia == 'user');
    if (!personal || d.excludeGroupIds.has(personal.group.id)) return [];

    return [
      {
        id: `person:${person.id}`,
        label: person.name || person.email,
        description: person.name ? person.email : undefined,
        data: {
          kind: 'person',
          consumerGroupId: personal.group.id,
          name: person.name || person.email,
          imageUrl: person.imageUrl
        }
      } satisfies ComboboxItemData<ManagerCandidate>
    ];
  });

  return {
    items: [
      ...(groupItems.length ? [{ label: 'Groups', items: groupItems }] : []),
      ...(personItems.length ? [{ label: 'People', items: personItems }] : [])
    ],
    isLoading: groups.isLoading || people.isLoading,
    empty: d.searchQuery ? 'No matching groups or people.' : 'Everyone is already a manager.'
  };
};

let CandidateOption = (p: { item: ComboboxItemData<ManagerCandidate> }) => (
  <Flex align="center" gap={10}>
    {p.item.data ? (
      <SubjectAvatar
        kind={p.item.data.kind}
        id={p.item.data.consumerGroupId}
        name={p.item.data.name}
        imageUrl={p.item.data.imageUrl}
        isDefault={p.item.data.isDefault}
        size={24}
      />
    ) : null}
    <Flex direction="column">
      <Text size="2">{p.item.label}</Text>
      {p.item.description ? (
        <Text size="1" color="gray600">
          {p.item.description}
        </Text>
      ) : null}
    </Flex>
  </Flex>
);

let scopeLabel = (row: MarketplaceManagerRow) => {
  if (row.scope.type == 'entire') return 'All plugins';

  let names = row.scope.plugins.map(plugin => plugin.name);
  let visible = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${visible} +${names.length - 2}` : visible;
};

export let MarketplaceManagerShareList = (p: {
  instanceId: string;
  portalId: string;
  skillMarketplaceId: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  rows: MarketplaceManagerRow[];
  refetch: () => void;
}) => {
  let createAccess = useCreatePortalConsumerAccessQuiet();
  let deleteAccess = useDeletePortalConsumerAccess();
  let managerGroupIds = new Set(p.rows.map(row => row.consumerGroupId));
  let entireCount = p.rows.filter(row => row.scope.type == 'entire').length;

  let editScope = (row: MarketplaceManagerRow) =>
    showMarketplaceManagerPanel({
      instanceId: p.instanceId,
      skillMarketplaceId: row.skillMarketplaceId,
      portalId: row.portalId,
      consumerGroupId: row.consumerGroupId,
      edit: row,
      onSuccess: p.refetch
    });

  let remove = (row: MarketplaceManagerRow) =>
    confirm({
      title: 'Remove Manager',
      description: `${row.name} will no longer be able to manage this marketplace.`,
      confirmText: 'Remove',
      onConfirm: async () => {
        let removed = await removeMarketplaceManager({
          instanceId: p.instanceId,
          portalId: row.portalId,
          row,
          deleteAccess
        });
        if (removed) p.refetch();
      }
    });

  return (
    <>
      <ShareList<ManagerCandidate>
        title={p.title}
        description={p.description}
        addPlaceholder="Add groups or people as managers…"
        disabled={createAccess.isLoading}
        provider={({ searchQuery }) =>
          useManagerCandidates({
            instanceId: p.instanceId,
            portalId: p.portalId,
            searchQuery,
            excludeGroupIds: managerGroupIds
          })
        }
        renderItem={item => <CandidateOption item={item} />}
        onAdd={async item => {
          if (!item.data) return;

          let [created] = await createAccess.mutate({
            instanceId: p.instanceId,
            portalId: p.portalId,
            consumerGroupId: item.data.consumerGroupId,
            access: {
              type: 'skill_marketplace',
              skillMarketplaceId: p.skillMarketplaceId,
              permission: 'manage'
            }
          });
          if (!created) return;

          toast.success(`${item.data.name} can now manage this marketplace`);
          p.refetch();
        }}
        summary={
          p.rows.length
            ? [
                <>
                  <b>{p.rows.length}</b> {p.rows.length == 1 ? 'manager' : 'managers'}
                </>,
                <>
                  <b>{entireCount}</b> with all plugins
                </>,
                <>
                  <b>{p.rows.length - entireCount}</b> with specific plugins
                </>
              ]
            : undefined
        }
      >
        {p.rows.length ? (
          p.rows.map(row => (
            <AccessRow
              key={row.id}
              lead={
                <AccessEntityCell
                  icon={
                    <SubjectAvatar
                      kind={row.kind == 'account' ? 'person' : 'group'}
                      id={row.consumerGroupId}
                      name={row.name}
                    />
                  }
                  title={row.name}
                  subtitle={row.description ?? (row.kind == 'account' ? 'Person' : 'Group')}
                />
              }
              detail={
                <AccessDetail
                  icon={
                    row.scope.type == 'entire' ? (
                      <RiStackLine size={14} />
                    ) : (
                      <RiPuzzleLine size={14} />
                    )
                  }
                  title="Change which plugins they manage"
                  onClick={() => editScope(row)}
                >
                  {scopeLabel(row)}
                </AccessDetail>
              }
              level="manage"
              actions={
                <AccessRowMenu
                  items={[
                    { id: 'scope', label: 'Change Plugins…' },
                    { type: 'separator' },
                    { id: 'remove', label: 'Remove Manager' }
                  ]}
                  onItemClick={id => {
                    if (id == 'scope') editScope(row);
                    if (id == 'remove') remove(row);
                  }}
                />
              }
            />
          ))
        ) : (
          <AccessEmpty
            title="No managers yet"
            description="Managers can update skills and plugins in this marketplace."
          />
        )}
      </ShareList>

      <createAccess.RenderError />
      <deleteAccess.RenderError />
    </>
  );
};
