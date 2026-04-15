import { renderWithLoader } from '@metorial-io/data-hooks';
import { Badge, Button, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { globalSsoTenantsState } from '../../state';

export let SettingsPage = () => {
  let globalSsoTenants = globalSsoTenantsState.use();

  return renderWithLoader({ globalSsoTenants })(({ globalSsoTenants }) => (
    <>
      <Title weight="strong" as="h1" size="7">
        Settings
      </Title>

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        Global SSO Tenants
      </Title>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
        Global SSO tenants are available as authentication options on all apps.
      </p>

      <Table
        headers={['Name', 'Status', 'Owning App', 'Connections', 'Created At', '']}
        data={globalSsoTenants.data.items.map((tenant: any) => ({
          data: [
            <>
              {tenant.name}{' '}
              <Badge color="blue" style={{ marginLeft: 8 }}>
                Global
              </Badge>
            </>,
            tenant.status,
            tenant.app.clientId,
            tenant.counts.connections,
            new Date(tenant.createdAt).toLocaleDateString('de-at'),
            <Button as="span" size="1">
              View
            </Button>
          ],
          href: `/apps/${tenant.app.id}/sso/${tenant.id}`
        }))}
      />
    </>
  ));
};
