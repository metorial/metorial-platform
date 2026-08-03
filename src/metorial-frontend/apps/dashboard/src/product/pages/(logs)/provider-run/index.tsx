import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderRun } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProviderRunEvents } from '../../../scenes/providerRun/events';

export let ProviderRunPage = () => {
  let instance = useCurrentInstance();

  let { providerRunId } = useParams();
  let providerRun = useProviderRun(instance.data?.id, providerRunId);

  return renderWithLoader({ providerRun })(({ providerRun }) => (
    <>
      <ProviderRunEvents providerRun={providerRun.data} />
    </>
  ));
};
