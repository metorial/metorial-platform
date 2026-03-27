import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { SessionTemplatesTable } from '../../../scenes/sessionTemplates/table';

export let SessionTemplatesPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <SessionTemplatesTable instanceId={instance.data.id} />
  ));
};
