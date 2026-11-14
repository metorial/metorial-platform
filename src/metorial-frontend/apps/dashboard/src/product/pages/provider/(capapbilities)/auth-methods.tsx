import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderAuthMethodsTable } from '../../../scenes/providers/authMethodsTable';
import { useProviderVersionContext } from '../providerVersionContext';

export let ProviderAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();

  return renderWithLoader({ instance })(({ instance }) => (
    <ProviderAuthMethodsTable
      instanceId={instance.data.id}
      providerVersionId={selectedVersionId}
    />
  ));
};
