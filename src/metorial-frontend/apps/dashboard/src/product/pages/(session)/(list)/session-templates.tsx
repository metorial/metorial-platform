import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { SessionTemplatesTable } from '../../../scenes/sessionTemplates/table';

export let SessionTemplatesPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <PaginationSearchParamsProvider enabled={true}>
      <SessionTemplatesTable instanceId={instance.data.id} />
    </PaginationSearchParamsProvider>
  ));
};
