import { renderWithPagination } from '@metorial-io/data-hooks';
import { Badge, Flex, Group, Input, Spacer, Text, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, FilterButton } from '../../components/styled.js';
import {
  useWebhookTriggers,
  type WebhookTriggerOwner,
  type WebhookTriggerType
} from '../../state/index.js';

let statusColors: Record<string, 'gray' | 'green' | 'red'> = {
  awaiting_setup: 'gray',
  active: 'green',
  deleted: 'red'
};

type TypeFilter = 'all' | WebhookTriggerType;
type OwnerFilter = 'all' | WebhookTriggerOwner;

export let WebhookTriggerList = () => {
  let [search, setSearch] = useState('');
  let [debouncedSearch, setDebouncedSearch] = useState(search);
  let [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  let [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');

  useEffect(() => {
    let timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  let searchQuery = debouncedSearch.trim() || undefined;
  let triggers = useWebhookTriggers({
    search: searchQuery,
    types: typeFilter === 'all' ? undefined : [typeFilter],
    owners: ownerFilter === 'all' ? undefined : [ownerFilter]
  });

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No webhook triggers found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        {searchQuery
          ? `No webhook triggers match "${searchQuery}".`
          : 'No webhook registrations have been created yet.'}
      </Text>
    </EmptyState>
  );

  return (
    <Flex direction="column" gap={32}>
      <Flex justify="space-between" align="end" gap={16} style={{ flexWrap: 'wrap' }}>
        <div>
          <Title size="6" weight="strong">
            Webhook Triggers
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            Every webhook registration in this hub — automated, manual, tenant, and global.
            Development only.
          </Text>
        </div>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <Input
            label="Search webhook triggers"
            hideLabel
            placeholder="Search by tenant, slate, trigger, name..."
            value={search}
            onInput={value => setSearch(value)}
          />
        </div>
      </Flex>

      <Flex gap={8} style={{ flexWrap: 'wrap' }}>
        <FilterButton $active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
          All Types
        </FilterButton>
        <FilterButton
          $active={typeFilter === 'manual'}
          onClick={() => setTypeFilter('manual')}
        >
          Manual
        </FilterButton>
        <FilterButton
          $active={typeFilter === 'automated'}
          onClick={() => setTypeFilter('automated')}
        >
          Automated
        </FilterButton>
        <FilterButton $active={ownerFilter === 'all'} onClick={() => setOwnerFilter('all')}>
          All Owners
        </FilterButton>
        <FilterButton
          $active={ownerFilter === 'tenant'}
          onClick={() => setOwnerFilter('tenant')}
        >
          Tenant
        </FilterButton>
        <FilterButton
          $active={ownerFilter === 'global'}
          onClick={() => setOwnerFilter('global')}
        >
          Global
        </FilterButton>
      </Flex>

      {renderWithPagination(triggers, { emptyState })(({ data }) => {
        let items = data.items;

        if (items.length === 0) return emptyState;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Name', 'Tenant', 'Slate', 'Trigger Group', 'Type', 'Owner', 'Status']}
              data={items.map(trigger => ({
                href: `/dev/webhook-triggers/${trigger.id}`,
                data: [
                  <Flex direction="column">
                    <Text size="2" weight="strong">
                      {trigger.name}
                    </Text>
                    {trigger.webhookTarget ? (
                      <Text size="1" color="gray600">
                        {trigger.webhookTarget.targetIdentifier}
                      </Text>
                    ) : null}
                  </Flex>,
                  trigger.tenant ? (
                    <Flex direction="column">
                      <Text size="2">{trigger.tenant.name}</Text>
                      <Text size="1" color="gray600">
                        {trigger.tenant.identifier}
                      </Text>
                    </Flex>
                  ) : (
                    <Text size="2" color="gray600">
                      Global
                    </Text>
                  ),
                  <Link to={`/slates/${trigger.slate.id}`} style={{ textDecoration: 'none' }}>
                    <Text size="2">{trigger.slate.name || trigger.slate.identifier}</Text>
                  </Link>,
                  <Flex direction="column">
                    <Text size="2">{trigger.triggerGroup.name}</Text>
                    <Text size="1" color="gray600">
                      {trigger.triggerGroup.key}
                    </Text>
                  </Flex>,
                  <Badge color="gray">{trigger.type}</Badge>,
                  <Badge color="gray">{trigger.owner}</Badge>,
                  <Badge color={statusColors[trigger.status] || 'gray'}>{trigger.status}</Badge>
                ]
              }))}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
