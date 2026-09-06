import { renderWithPagination } from '@metorial-io/data-hooks';
import { Badge, Button, Flex, Group, InlineCopy, RenderDate, Spacer, Text, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { Link } from 'react-router-dom';
import { EmptyState, MonoCode } from '../../components/styled.js';
import { useWebhooks } from '../../state/index.js';

let statusColors: Record<string, 'gray' | 'green' | 'red'> = {
  awaiting_setup: 'gray',
  active: 'green',
  deleted: 'red'
};

export let WebhookList = () => {
  let webhooks = useWebhooks();

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No global webhooks found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        Global webhooks aren't linked to a tenant and work across all of them.
      </Text>
    </EmptyState>
  );

  return (
    <Flex direction="column" gap={32}>
      <Flex justify="space-between" align="center">
        <div>
          <Title size="6" weight="strong">
            Global Webhooks
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            Webhooks configured once here that work across every tenant.
          </Text>
        </div>
        <Link to="/webhooks/new" style={{ textDecoration: 'none' }}>
          <Button as="span" color="blue">
            Create webhook
          </Button>
        </Link>
      </Flex>

      {renderWithPagination(webhooks, { emptyState })(({ data }) => {
        let items = data.items;

        if (items.length === 0) return emptyState;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Name', 'Slate', 'Status', 'URL Key', 'Created', 'Actions']}
              data={items.map(webhook => ({
                data: [
                  <Text size="2" weight="strong">
                    {webhook.name}
                  </Text>,
                  webhook.slateId ? (
                    <Link to={`/slates/${webhook.slateId}`} style={{ textDecoration: 'none' }}>
                      <MonoCode>{webhook.slateId}</MonoCode>
                    </Link>
                  ) : (
                    <Text size="2" color="gray600">
                      -
                    </Text>
                  ),
                  <Badge color={statusColors[webhook.status] || 'gray'}>{webhook.status}</Badge>,
                  <Flex align="center" gap={6}>
                    <MonoCode>{webhook.urlKey}</MonoCode>
                    <InlineCopy value={webhook.urlKey} />
                  </Flex>,
                  <RenderDate date={webhook.createdAt} />,
                  <Link to={`/webhooks/${webhook.id}`} style={{ textDecoration: 'none' }}>
                    <Button as="span" size="2" variant="outline">
                      View
                    </Button>
                  </Link>
                ]
              }))}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
