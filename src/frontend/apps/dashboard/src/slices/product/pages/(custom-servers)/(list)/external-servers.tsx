import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { CustomServersTable } from '../../../scenes/customServer/table';

export let ExternalServersPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <CustomServersTable type="remote" />
    </>
  ));
};
