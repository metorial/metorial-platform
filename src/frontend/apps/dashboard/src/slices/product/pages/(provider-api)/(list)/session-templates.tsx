import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { SessionTemplatesTable } from '../../../scenes/sessionTemplates/table';

export let SessionTemplatesPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Spacer size={15} />

      <SessionTemplatesTable instanceId={instance.data.instanceId} />
    </>
  ));
};
