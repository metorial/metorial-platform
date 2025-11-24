import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { PortalsGrid } from '../../../scenes/portals/portalsGrid';

export let PortalsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <PortalsGrid />);
};
