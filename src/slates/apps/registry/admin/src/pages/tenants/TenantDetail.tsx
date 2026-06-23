import { useParams } from 'react-router-dom';
import { renderWithLoader } from '@metorial-io/data-hooks';
import { Flex, Group, Badge as UiBadge, Datalist, RenderDate } from '@metorial-io/ui';
import { useTenant } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { MonoCode } from '../../components/styled';

export let TenantDetail = () => {
  let { tenantId } = useParams<{ tenantId: string }>();
  let tenant = useTenant(tenantId!);

  return renderWithLoader({ tenant })(({ tenant }) => (
    <Flex direction="column" gap={24}>
      <BackLink to="/tenants">Back to Tenants</BackLink>

      <Group.Wrapper>
        <Group.Header
          title={tenant.data!.name}
          description={
            <UiBadge color="gray" size="1">
              <code>{tenant.data!.identifier}</code>
            </UiBadge>
          }
        />
        <Group.Content>
          <Datalist
            items={[
              { label: 'ID', value: <MonoCode>{tenant.data!.id}</MonoCode> },
              { label: 'Identifier', value: tenant.data!.identifier },
              { label: 'Created', value: <RenderDate date={tenant.data!.createdAt} /> }
            ]}
          />
        </Group.Content>
      </Group.Wrapper>
    </Flex>
  ));
}
