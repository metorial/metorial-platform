import { renderWithLoader, useMutation } from '@metorial-io/data-hooks';
import { Button, Datalist, Spacer, Switch, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useParams } from 'react-router-dom';
import { ssoConnectionsState, ssoTenantState } from '../../../../../state';
import { adminClient } from '../../../../../state/client';

export let SsoTenantPage = () => {
  let { appId, ssoTenantId } = useParams();
  let ssoTenant = ssoTenantState.use({ id: ssoTenantId! });
  let ssoTenantRoot = ssoTenant;
  let connections = ssoConnectionsState.use({ tenantId: ssoTenantId! });
  let createSetup = useMutation(adminClient.sso.createSetup);
  let setGlobal = useMutation(adminClient.sso.setGlobal);

  return renderWithLoader({ ssoTenant, connections })(({ ssoTenant, connections }) => (
    <>
      <Title weight="strong" as="h1" size="7">
        {ssoTenant.data.name}
      </Title>

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        SSO Tenant Details
      </Title>

      <Datalist
        items={[
          { label: 'ID', value: ssoTenant.data.id },
          { label: 'Name', value: ssoTenant.data.name },
          { label: 'Status', value: ssoTenant.data.status },
          { label: 'Client ID', value: ssoTenant.data.clientId },
          { label: 'External ID', value: ssoTenant.data.externalId ?? '-' },
          {
            label: 'Created At',
            value: new Date(ssoTenant.data.createdAt).toLocaleDateString('de-at')
          },
          {
            label: 'Updated At',
            value: new Date(ssoTenant.data.updatedAt).toLocaleDateString('de-at')
          }
        ]}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Global SSO
        </Title>
      </div>

      <Switch
        label="Available on all apps"
        checked={ssoTenant.data.isGlobal}
        disabled={setGlobal.isLoading}
        onCheckedChange={async checked => {
          let [res] = await setGlobal.mutate({ id: ssoTenantId!, isGlobal: checked });
          if (res) ssoTenantRoot.refetch();
        }}
      />
      <setGlobal.RenderError />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Connections
        </Title>

        <Button
          size="1"
          loading={createSetup.isLoading}
          onClick={async () => {
            let [res] = await createSetup.mutate({
              tenantId: ssoTenantId!,
              appId: appId!
            });
            if (res) {
              window.open(res.setupUrl, '_blank');
            }
          }}
        >
          Add Connection
        </Button>
      </div>

      <createSetup.RenderError />

      <Table
        headers={['Name', 'Provider Type', 'Provider Name', 'Created At']}
        data={connections.data.items.map((connection: any) => [
          connection.name,
          connection.providerType,
          connection.providerName ?? '-',
          new Date(connection.createdAt).toLocaleDateString('de-at')
        ])}
      />

      <Spacer size={10} />
    </>
  ));
};
