import { SubjectAvatar, type AccessSubjectKind } from '@metorial/access-ui';
import { usePortalConsumerGroups, usePortalConsumerProfiles } from '@metorial/state';
import { Flex, Text, type ComboboxItemData } from '@metorial/ui';

let candidateLimit = 10;

let personalGroupPrefix = 'Personal Group for ';

export type PortalShareTargetOption = {
  kind: AccessSubjectKind;
  consumerGroupId: string;
  name: string;
  imageUrl?: string | null;
};

export let personalGroupEmail = (name: string) =>
  name.startsWith(personalGroupPrefix) ? name.slice(personalGroupPrefix.length) : null;

export let displayConsumerGroupName = (name: string) => personalGroupEmail(name) ?? name;

export let usePortalShareTargets = (d: {
  instanceId: string;
  portalId: string;
  searchQuery?: string;
  excludeGroupIds: Set<string>;
}) => {
  let groups = usePortalConsumerGroups(d.instanceId, d.portalId, {
    limit: candidateLimit,
    search: d.searchQuery
  });
  let people = usePortalConsumerProfiles(d.instanceId, d.portalId, {
    limit: candidateLimit,
    search: d.searchQuery,
    status: 'active'
  });

  let groupItems: ComboboxItemData<PortalShareTargetOption>[] = (groups.data?.items ?? [])
    .filter(group => !group.isDefault && !d.excludeGroupIds.has(group.id))
    .map(group => ({
      id: `group:${group.id}`,
      label: group.name,
      description: group.description ?? undefined,
      data: { kind: 'group', consumerGroupId: group.id, name: group.name }
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
      } satisfies ComboboxItemData<PortalShareTargetOption>
    ];
  });

  return {
    items: [
      ...(groupItems.length ? [{ label: 'Access Groups', items: groupItems }] : []),
      ...(personItems.length ? [{ label: 'People', items: personItems }] : [])
    ],
    isLoading: groups.isLoading || people.isLoading,
    empty: d.searchQuery
      ? 'No matching access groups or people.'
      : 'Everyone already has access.'
  };
};

export let PortalShareTargetItem = (p: { item: ComboboxItemData<PortalShareTargetOption> }) =>
  p.item.data ? (
    <Flex align="center" gap={10}>
      <SubjectAvatar
        kind={p.item.data.kind}
        id={p.item.data.consumerGroupId}
        name={p.item.data.name}
        imageUrl={p.item.data.imageUrl}
        size={24}
      />
      <Flex direction="column">
        <Text size="2">{p.item.label}</Text>
        {p.item.description ? (
          <Text size="1" color="gray600">
            {p.item.description}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  ) : (
    <Text size="2">{p.item.label}</Text>
  );
