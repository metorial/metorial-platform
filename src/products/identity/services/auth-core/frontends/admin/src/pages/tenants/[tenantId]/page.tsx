import { renderWithLoader } from '@metorial-io/data-hooks';
import { Datalist, Title } from '@metorial-io/ui';
import { useParams } from 'react-router-dom';
import { tenantState } from '../../../state';

export let TenantPage = () => {
  let { tenantId } = useParams();
  let tenant = tenantState.use({ id: tenantId! });

  return renderWithLoader({ tenant })(({ tenant }) => (
    <>
      <Title weight="strong" as="h1" size="7">
        {tenant.data.clientId}
      </Title>

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        Tenant Details
      </Title>

      <Datalist
        items={[
          { label: 'ID', value: tenant.data.id },
          { label: 'Client ID', value: tenant.data.clientId },
          { label: 'App ID', value: tenant.data.appId ?? '-' },
          { label: 'Users', value: tenant.data.counts.users },
          {
            label: 'Created At',
            value: new Date(tenant.data.createdAt).toLocaleDateString('de-at')
          },
          {
            label: 'Updated At',
            value: new Date(tenant.data.updatedAt).toLocaleDateString('de-at')
          }
        ]}
      />
    </>
  ));
};
