import { ProviderSearch } from '../../providers/search';
import { useWizard } from '../index';

export let SelectProviderStep = ({ instanceId: _instanceId }: { instanceId: string }) => {
  let { setProviderId } = useWizard();

  return (
    <ProviderSearch
      onSelect={provider =>
        setProviderId(provider.id, provider.name ?? provider.slug ?? 'Provider')
      }
    />
  );
};
