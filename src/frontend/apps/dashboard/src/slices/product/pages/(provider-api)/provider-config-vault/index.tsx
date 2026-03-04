import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConfigVault } from '@metorial/state';
import { Attributes, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderConfigVaultOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);

  return renderWithLoader({ vault })(({ vault }) => (
    <Attributes
      itemWidth="250px"
      attributes={[
        {
          label: 'Name',
          content: vault.data.name ?? '—'
        },
        {
          label: 'Description',
          content: vault.data.description ?? '—'
        },
        {
          label: 'ID',
          content: <ID id={vault.data.id} />
        },
        {
          label: 'Provider',
          content: vault.data.providerId ?? '—'
        },
        {
          label: 'Deployment',
          content: vault.data.deployment?.name ?? '—'
        },
        {
          label: 'Created',
          content: vault.data.createdAt ? <RenderDate date={vault.data.createdAt} /> : '—'
        },
        {
          label: 'Updated',
          content: vault.data.updatedAt ? <RenderDate date={vault.data.updatedAt} /> : '—'
        }
      ]}
    />
  ));
};
