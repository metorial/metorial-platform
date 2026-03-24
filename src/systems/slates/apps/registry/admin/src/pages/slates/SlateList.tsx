import { Link, useNavigate, useParams } from 'react-router-dom';
import { renderWithPagination } from '@metorial-io/data-hooks';
import { Button, Text, Title, Badge, Flex, Spacer, Group } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useSlates } from '../../hooks';
import { EmptyState, SlateLogoImage, SlateLogoPlaceholder } from '../../components/styled';

export let SlateList = () => {
  let navigate = useNavigate();
  let { tenantId } = useParams<{ tenantId: string }>();
  let slates = useSlates(tenantId);

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No slates found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        This tenant doesn't have any slates yet.
      </Text>
    </EmptyState>
  );

  return (
    <Flex direction="column" gap={32}>
      <Flex justify="space-between" align="center">
        <div>
          <Title size="6" weight="strong">
            Slates
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            Slates are versioned packages published to this registry. Each slate belongs to a
            scope (user or workspace).
          </Text>
        </div>
        <Flex gap={8}>
          <Button variant="outline" onClick={() => navigate(`/tenants/${tenantId}/slates/bulk-new`)}>
            Bulk Create
          </Button>
          <Button onClick={() => navigate(`/tenants/${tenantId}/slates/new`)}>
            + New Slate
          </Button>
        </Flex>
      </Flex>

      {renderWithPagination(slates, { emptyState })(({ data }) => {
        let items = data.items;

        return (
          <Group.Wrapper>
            <Table
              padding={{ sides: '20px' }}
              headers={['Slate', 'Version', 'Access', 'Actions']}
              data={items.map(slate => ({
                href: `/tenants/${tenantId}/slates/${slate.id}`,
                data: [
                  <Flex align="center" gap={14}>
                    {slate.logoUrl ? (
                      <SlateLogoImage src={slate.logoUrl} alt="" />
                    ) : (
                      <SlateLogoPlaceholder align="center" justify="center">
                        S
                      </SlateLogoPlaceholder>
                    )}
                    <Flex direction="column">
                      <Text size="2" weight="strong">
                        {slate.name}
                      </Text>
                      <Text size="1" color="gray600">
                        {slate.fullIdentifier}
                      </Text>
                    </Flex>
                  </Flex>,
                  <Badge color="blue">v{slate.currentVersion?.version ?? '-'}</Badge>,
                  <Badge color={slate.access === 'public' ? 'green' : 'gray'}>
                    {slate.access}
                  </Badge>,
                  <Link
                    to={`/tenants/${tenantId}/slates/${slate.id}/publish`}
                    onClick={e => e.stopPropagation()}
                  >
                    <Button as="span">Publish</Button>
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
